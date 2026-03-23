from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # アプリ基本設定
    APP_NAME: str = "家計簿アプリ"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # データベース設定（MVPはSQLite、PostgreSQLへの切り替えも容易）
    DATABASE_URL: str = "sqlite+aiosqlite:///./finance.db"

    # ファイルストレージ設定（将来的にS3等への切り替え可能）
    UPLOAD_DIR: Path = Path("uploads")
    STATEMENT_DIR: Path = Path("uploads/statements")
    RECEIPT_DIR: Path = Path("uploads/receipts")
    MAX_UPLOAD_SIZE_MB: int = 50

    # OCR設定
    TESSERACT_LANG: str = "jpn+eng"  # 日本語+英語対応

    # MVP: 固定ユーザーID（マルチユーザー化は認証モジュール追加で対応）
    DEFAULT_USER_ID: int = 1

    # CORS / ホスト制御（本番は独自ドメインを必ず設定）
    CORS_ALLOW_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    TRUSTED_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1",
    ]

    # マッチング設定
    RECEIPT_MATCH_AMOUNT_TOLERANCE: float = 0.01  # 金額の許容誤差（円）
    RECEIPT_MATCH_DATE_TOLERANCE_DAYS: int = 3    # 日付の許容誤差（日）

    # Plaid設定（米国の銀行連携）
    PLAID_CLIENT_ID: str = ""
    PLAID_SECRET: str = ""
    PLAID_ENV: str = "sandbox"  # sandbox / development / production

    @field_validator("CORS_ALLOW_ORIGINS", "TRUSTED_HOSTS", mode="before")
    @classmethod
    def _parse_csv_list(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# アップロードディレクトリが存在しない場合は作成
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.STATEMENT_DIR.mkdir(parents=True, exist_ok=True)
settings.RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
