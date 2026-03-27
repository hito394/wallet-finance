"""
AI Spending Coach – POST /chat

Uses the Claude API (claude-haiku-4-5) with a rich financial context prompt
assembled from the user's real transaction data.  Responds in the same
language the user writes in (Japanese or English).
"""
from __future__ import annotations

import os
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.category import Category
from app.models.transaction import Transaction, TransactionDirection
from app.utils.user_context import resolve_actor_context

router = APIRouter()

# ─── Anthropic client (lazy) ──────────────────────────────────────────────────

def _get_anthropic_client():
    try:
        import anthropic  # type: ignore[import-untyped]
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="AI service not available (anthropic package missing)") from exc

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured (ANTHROPIC_API_KEY missing)")

    return anthropic.Anthropic(api_key=api_key)


# ─── Financial context builder ────────────────────────────────────────────────

def _build_financial_context(db: Session, entity_id) -> str:
    today = date.today()
    current_year = today.year
    current_month = today.month

    # Last 3 months of spend/income
    monthly_lines: list[str] = []
    for delta in range(2, -1, -1):
        d = today.replace(day=1) - timedelta(days=delta * 28)
        yr, mo = d.year, d.month
        rows = db.execute(
            select(
                Transaction.direction,
                func.sum(Transaction.amount).label("total"),
            )
            .where(
                Transaction.entity_id == entity_id,
                extract("year", Transaction.transaction_date) == yr,
                extract("month", Transaction.transaction_date) == mo,
                Transaction.is_ignored.is_(False),
                Transaction.transaction_date <= today,
            )
            .group_by(Transaction.direction)
        ).all()
        spend = Decimal("0")
        income = Decimal("0")
        for direction, total in rows:
            if direction == TransactionDirection.debit:
                spend = total or Decimal("0")
            elif direction == TransactionDirection.credit:
                income = total or Decimal("0")
        net = income - spend
        sign = "+" if net >= 0 else ""
        monthly_lines.append(f"  {yr}-{mo:02d}: income=${income:.0f}, spend=${spend:.0f}, net={sign}{net:.0f}")

    # Current month top categories
    cat_rows = db.execute(
        select(Category.name, func.sum(Transaction.amount).label("total"))
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(
            Transaction.entity_id == entity_id,
            extract("year", Transaction.transaction_date) == current_year,
            extract("month", Transaction.transaction_date) == current_month,
            Transaction.direction == TransactionDirection.debit,
            Transaction.is_ignored.is_(False),
            Transaction.transaction_date <= today,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(8)
    ).all()
    cat_lines = [f"  {name or 'Uncategorized'}: ${total:.0f}" for name, total in cat_rows]

    # Recent 10 transactions
    recent = db.execute(
        select(
            Transaction.transaction_date,
            Transaction.description,
            Transaction.amount,
            Transaction.direction,
            Category.name,
        )
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(
            Transaction.entity_id == entity_id,
            Transaction.is_ignored.is_(False),
            Transaction.transaction_date <= today,
        )
        .order_by(Transaction.transaction_date.desc())
        .limit(10)
    ).all()
    tx_lines = []
    for tx_date, desc, amount, direction, cat in recent:
        sign = "-" if direction == TransactionDirection.debit else "+"
        tx_lines.append(f"  {tx_date} {sign}${amount:.2f} [{cat or 'Uncategorized'}] {desc}")

    context = f"""=== Financial Context (as of {today}) ===

Monthly summary (last 3 months):
{chr(10).join(monthly_lines) or '  No data'}

Top spending categories this month:
{chr(10).join(cat_lines) or '  No data'}

Recent transactions:
{chr(10).join(tx_lines) or '  No data'}
"""
    return context


# ─── Request / Response ───────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


# ─── Endpoint ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a friendly, knowledgeable personal finance coach embedded in a finance app.
You have access to the user's real transaction data (provided below).
Answer questions about their spending, income, trends, and give actionable advice.
Respond in the same language the user writes in — Japanese or English.
Keep answers concise (2-4 sentences) unless the user asks for detail.
Never fabricate numbers; only use the data provided. If data is insufficient, say so honestly.
"""


@router.post("", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ChatResponse:
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    financial_context = _build_financial_context(db, entity.id)

    client = _get_anthropic_client()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT + "\n\n" + financial_context,
        messages=[{"role": "user", "content": body.message}],
    )

    reply = response.content[0].text if response.content else "No response generated."
    return ChatResponse(reply=reply)
