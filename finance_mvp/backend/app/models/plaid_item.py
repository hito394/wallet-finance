"""
PlaidItem  – one per connected bank / institution (holds access_token).
BankAccount – one per account within a PlaidItem (checking, savings, credit …).
"""

import uuid
import enum

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Numeric, String, func,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    entity_id        = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)

    # Plaid identifiers
    plaid_item_id    = Column(String(120), nullable=False, unique=True, index=True)
    access_token     = Column(String(255), nullable=False)   # store encrypted in production
    # Cursor for transactions/sync (incremental sync)
    sync_cursor      = Column(String(512), nullable=True)

    # Institution metadata
    institution_id   = Column(String(120), nullable=True)
    institution_name = Column(String(255), nullable=True)

    last_synced_at   = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plaid_item_id     = Column(UUID(as_uuid=True), ForeignKey("plaid_items.id"), nullable=False, index=True)
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    entity_id         = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)

    plaid_account_id  = Column(String(120), nullable=False, unique=True, index=True)
    name              = Column(String(255), nullable=False)
    official_name     = Column(String(255), nullable=True)
    account_type      = Column(String(80), nullable=True)   # depository | credit | investment …
    account_subtype   = Column(String(80), nullable=True)   # checking | savings | credit card …
    mask              = Column(String(10), nullable=True)    # last 4 digits

    currency          = Column(String(3), default="USD")
    current_balance   = Column(Numeric(14, 2), nullable=True)
    available_balance = Column(Numeric(14, 2), nullable=True)

    is_active         = Column(Boolean, default=True)
    last_synced_at    = Column(DateTime(timezone=True), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
