"""
Plaid銀行連携ルーター（米国の銀行・クレカの自動同期）

エンドポイント:
  GET  /api/plaid/link-token      - Plaid Link起動用トークン生成
  POST /api/plaid/exchange        - public_token → access_token交換 & 保存
  GET  /api/plaid/accounts        - 連携済み銀行一覧（口座情報含む）
  POST /api/plaid/sync/{item_id}  - 取引データ同期
  DELETE /api/plaid/items/{item_id} - 連携解除
"""
from datetime import datetime, date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction, TransactionDirection
from app.models.import_record import ImportRecord, ImportType, ImportStatus
from app.services.categorization_service import CategorizationService

_categorizer = CategorizationService()

router = APIRouter(prefix="/api/plaid", tags=["plaid"])
CURRENT_USER_ID = settings.DEFAULT_USER_ID


def _get_plaid_client():
    """Plaid APIクライアントを返す。未設定の場合はエラー"""
    if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
        raise HTTPException(
            status_code=503,
            detail="plaid_not_configured: PLAID_CLIENT_ID と PLAID_SECRET を設定してください",
        )
    try:
        import plaid
        from plaid.api import plaid_api
        from plaid.configuration import Configuration
        from plaid.api_client import ApiClient

        env_map = {
            "sandbox": plaid.Environment.Sandbox,
            "development": plaid.Environment.Development,
            "production": plaid.Environment.Production,
        }
        env = env_map.get(settings.PLAID_ENV, plaid.Environment.Sandbox)

        configuration = Configuration(
            host=env,
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            },
        )
        api_client = ApiClient(configuration)
        return plaid_api.PlaidApi(api_client)
    except ImportError:
        raise HTTPException(status_code=503, detail="plaid-python がインストールされていません")


# ─── link-token 生成 ─────────────────────────────────────────────────────────

@router.get("/link-token")
async def create_link_token():
    """Plaid Link起動用のlink_tokenを生成する"""
    client = _get_plaid_client()

    try:
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products
        from plaid.model.country_code import CountryCode

        request = LinkTokenCreateRequest(
            products=[Products("transactions"), Products("balance")],
            client_name="Wallet Finance",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=str(CURRENT_USER_ID)),
        )
        response = client.link_token_create(request)
        return {
            "link_token": response["link_token"],
            "plaid_env": settings.PLAID_ENV,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plaid エラー: {str(e)}")


# ─── public_token 交換 ────────────────────────────────────────────────────────

@router.post("/exchange")
async def exchange_public_token(body: dict, db: AsyncSession = Depends(get_db)):
    """public_tokenをaccess_tokenに交換してDBに保存する"""
    public_token = body.get("public_token")
    if not public_token:
        raise HTTPException(status_code=400, detail="public_token が必要です")

    client = _get_plaid_client()

    try:
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

        exchange_response = client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=public_token)
        )
        access_token = exchange_response["access_token"]
        item_id = exchange_response["item_id"]

        # 機関情報を取得
        from plaid.model.item_get_request import ItemGetRequest
        from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
        from plaid.model.country_code import CountryCode

        item_response = client.item_get(ItemGetRequest(access_token=access_token))
        institution_id = item_response["item"]["institution_id"]
        institution_name = "Unknown Bank"

        if institution_id:
            try:
                inst_response = client.institutions_get_by_id(
                    InstitutionsGetByIdRequest(
                        institution_id=institution_id,
                        country_codes=[CountryCode("US")],
                    )
                )
                institution_name = inst_response["institution"]["name"]
            except Exception:
                pass

        # 既存チェック（再接続の場合は上書き）
        existing = (
            await db.execute(select(PlaidItem).where(PlaidItem.item_id == item_id))
        ).scalar_one_or_none()

        if existing:
            existing.access_token = access_token
            existing.institution_name = institution_name
        else:
            db.add(PlaidItem(
                user_id=CURRENT_USER_ID,
                item_id=item_id,
                access_token=access_token,
                institution_id=institution_id,
                institution_name=institution_name,
            ))

        await db.commit()
        return {"item_id": item_id, "institution_name": institution_name}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plaid エラー: {str(e)}")


# ─── 連携済み銀行一覧 ─────────────────────────────────────────────────────────

@router.get("/accounts")
async def get_plaid_accounts(db: AsyncSession = Depends(get_db)):
    """連携済みのPlaidアイテムと口座一覧を返す"""
    items = (
        await db.execute(
            select(PlaidItem).where(PlaidItem.user_id == CURRENT_USER_ID)
        )
    ).scalars().all()

    result = []
    client = _get_plaid_client() if (settings.PLAID_CLIENT_ID and settings.PLAID_SECRET) else None

    for item in items:
        accounts = item.accounts_cache or []

        # キャッシュが空なら取得
        if not accounts and client:
            try:
                from plaid.model.accounts_get_request import AccountsGetRequest
                resp = client.accounts_get(AccountsGetRequest(access_token=item.access_token))
                accounts = [
                    {
                        "id": a["account_id"],
                        "plaid_account_id": a["account_id"],
                        "name": a["name"],
                        "official_name": a.get("official_name"),
                        "account_type": a["type"],
                        "account_subtype": a.get("subtype"),
                        "mask": a.get("mask"),
                        "currency": a["balances"].get("iso_currency_code", "USD"),
                        "current_balance": a["balances"].get("current"),
                        "available_balance": a["balances"].get("available"),
                        "last_synced_at": None,
                    }
                    for a in resp["accounts"]
                ]
                item.accounts_cache = accounts
                await db.commit()
            except Exception:
                pass

        result.append({
            "id": str(item.id),
            "institution_name": item.institution_name,
            "institution_id": item.institution_id,
            "last_synced_at": item.last_synced_at.isoformat() if item.last_synced_at else None,
            "accounts": accounts,
        })

    return {"items": result}


# ─── 取引同期 ─────────────────────────────────────────────────────────────────

@router.post("/sync/{item_id}")
async def sync_plaid_item(item_id: str, db: AsyncSession = Depends(get_db)):
    """
    Plaid transactions/sync API で取引を差分同期する。
    - 初回: 利用可能な全履歴（最大24ヶ月）を取得
    - 以降: カーソルベースの差分同期（追加・変更・削除を正確に反映）
    - クレカ・銀行口座どちらも plaid_account_id で紐付け
    """
    plaid_item = (
        await db.execute(select(PlaidItem).where(PlaidItem.item_id == item_id))
    ).scalar_one_or_none()

    if not plaid_item:
        raise HTTPException(status_code=404, detail="Plaidアイテムが見つかりません")

    client = _get_plaid_client()

    try:
        from plaid.model.transactions_sync_request import TransactionsSyncRequest

        added_count = 0
        modified_count = 0
        removed_count = 0
        cursor = plaid_item.transactions_cursor  # Noneなら初回フル取得

        # インポートレコードを作成
        import_record = ImportRecord(
            user_id=CURRENT_USER_ID,
            original_filename=f"plaid_{plaid_item.institution_name}_{date.today()}",
            stored_filename=f"plaid_{item_id}",
            file_path="plaid://sync",
            import_type=ImportType.CSV_STATEMENT,
            status=ImportStatus.PROCESSING,
        )
        db.add(import_record)
        await db.flush()

        # ページネーションループ（has_more=Trueの間繰り返す）
        has_more = True
        while has_more:
            request_kwargs = {"access_token": plaid_item.access_token}
            if cursor:
                request_kwargs["cursor"] = cursor

            response = client.transactions_sync(
                TransactionsSyncRequest(**request_kwargs)
            )

            # 追加された取引
            for tx in response["added"]:
                if tx.get("pending", False):
                    continue

                tx_date = tx["date"]
                if isinstance(tx_date, str):
                    tx_date = datetime.strptime(tx_date, "%Y-%m-%d").date()

                amount_raw = tx["amount"]
                direction = TransactionDirection.DEBIT if amount_raw > 0 else TransactionDirection.CREDIT
                amount = Decimal(str(abs(amount_raw)))
                merchant_name = tx.get("merchant_name") or tx.get("name") or "Unknown"
                plaid_tx_id = tx["transaction_id"]
                plaid_account_id = tx.get("account_id")

                existing_tx = (
                    await db.execute(
                        select(Transaction).where(
                            Transaction.user_id == CURRENT_USER_ID,
                            Transaction.dedup_hash == f"plaid_{plaid_tx_id}",
                        )
                    )
                ).scalar_one_or_none()

                if existing_tx:
                    continue

                category = _categorizer.classify(
                    merchant_raw=merchant_name,
                    direction=direction.value,
                )

                db.add(Transaction(
                    user_id=CURRENT_USER_ID,
                    import_record_id=import_record.id,
                    transaction_date=tx_date,
                    merchant_raw=merchant_name,
                    merchant_normalized=merchant_name,
                    amount=amount,
                    direction=direction,
                    category=category,
                    source_type="csv_statement",
                    dedup_hash=f"plaid_{plaid_tx_id}",
                    plaid_account_id=plaid_account_id,
                ))
                added_count += 1

            # 変更された取引（ペンディング→確定など）
            for tx in response["modified"]:
                if tx.get("pending", False):
                    continue

                plaid_tx_id = tx["transaction_id"]
                existing_tx = (
                    await db.execute(
                        select(Transaction).where(
                            Transaction.user_id == CURRENT_USER_ID,
                            Transaction.dedup_hash == f"plaid_{plaid_tx_id}",
                        )
                    )
                ).scalar_one_or_none()

                if existing_tx:
                    tx_date = tx["date"]
                    if isinstance(tx_date, str):
                        tx_date = datetime.strptime(tx_date, "%Y-%m-%d").date()
                    amount_raw = tx["amount"]
                    existing_tx.transaction_date = tx_date
                    existing_tx.amount = Decimal(str(abs(amount_raw)))
                    existing_tx.direction = TransactionDirection.DEBIT if amount_raw > 0 else TransactionDirection.CREDIT
                    existing_tx.merchant_raw = tx.get("merchant_name") or tx.get("name") or existing_tx.merchant_raw
                    existing_tx.plaid_account_id = tx.get("account_id") or existing_tx.plaid_account_id
                    modified_count += 1

            # 削除された取引（返金・エラー修正など）
            for tx in response["removed"]:
                plaid_tx_id = tx["transaction_id"]
                existing_tx = (
                    await db.execute(
                        select(Transaction).where(
                            Transaction.user_id == CURRENT_USER_ID,
                            Transaction.dedup_hash == f"plaid_{plaid_tx_id}",
                        )
                    )
                ).scalar_one_or_none()
                if existing_tx:
                    await db.delete(existing_tx)
                    removed_count += 1

            cursor = response["next_cursor"]
            has_more = response["has_more"]

        # カーソルと同期時刻を更新
        plaid_item.transactions_cursor = cursor
        plaid_item.last_synced_at = datetime.utcnow()

        import_record.status = ImportStatus.COMPLETED
        import_record.success_rows = added_count
        import_record.skipped_rows = 0
        import_record.total_rows = added_count + modified_count
        import_record.completed_at = datetime.utcnow()

        # 口座残高を更新（銀行・クレカ両方）
        from plaid.model.accounts_get_request import AccountsGetRequest
        acct_resp = client.accounts_get(AccountsGetRequest(access_token=plaid_item.access_token))
        plaid_item.accounts_cache = [
            {
                "id": a["account_id"],
                "plaid_account_id": a["account_id"],
                "name": a["name"],
                "official_name": a.get("official_name"),
                "account_type": a["type"],
                "account_subtype": a.get("subtype"),
                "mask": a.get("mask"),
                "currency": a["balances"].get("iso_currency_code", "USD"),
                "current_balance": a["balances"].get("current"),
                "available_balance": a["balances"].get("available"),
                "credit_limit": a["balances"].get("limit"),  # クレカの利用上限額
                "last_synced_at": datetime.utcnow().isoformat(),
            }
            for a in acct_resp["accounts"]
        ]

        await db.commit()
        return {"added": added_count, "modified": modified_count, "removed": removed_count}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同期エラー: {str(e)}")


# ─── 連携解除 ─────────────────────────────────────────────────────────────────

@router.delete("/items/{item_id}")
async def disconnect_plaid_item(item_id: str, db: AsyncSession = Depends(get_db)):
    """Plaid連携を解除する（取引データは残す）"""
    plaid_item = (
        await db.execute(select(PlaidItem).where(PlaidItem.item_id == item_id))
    ).scalar_one_or_none()

    if not plaid_item:
        raise HTTPException(status_code=404, detail="Plaidアイテムが見つかりません")

    # Plaid側でもアクセストークンを無効化
    try:
        client = _get_plaid_client()
        from plaid.model.item_remove_request import ItemRemoveRequest
        client.item_remove(ItemRemoveRequest(access_token=plaid_item.access_token))
    except Exception:
        pass  # Plaid側のエラーは無視してDB削除を続行

    await db.delete(plaid_item)
    await db.commit()
    return {"ok": True}
