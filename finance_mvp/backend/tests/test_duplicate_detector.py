"""
Cross-source duplicate detection tests.
Verify that payments from checking accounts are detected as duplicates
when the same payment appears on credit card statements.
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.category import Category
from app.models.entity import Entity, EntityType
from app.models.transaction import Transaction, TransactionDirection, TransactionSource
from app.models.user import User
from app.services.dedupe.duplicate_detector import find_duplicate_by_cross_source


@pytest.fixture
def db():
    """Create in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def user(db):
    """Create a test user."""
    u = User(
        id=uuid.uuid4(),
        email="test@example.com",
        full_name="Test User",
    )
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def entity(db, user):
    """Create a test entity (account)."""
    e = Entity(
        id=uuid.uuid4(),
        owner_user_id=user.id,
        entity_type=EntityType.personal,
        name="Test Account",
    )
    db.add(e)
    db.flush()
    return e


@pytest.fixture
def category(db, entity):
    """Create a test category."""
    c = Category(
        id=uuid.uuid4(),
        entity_id=entity.id,
        name="Transfers",
        slug="transfers",
    )
    db.add(c)
    db.flush()
    return c


class TestCrossSourceDeduplication:
    """Test cross-source duplicate detection."""

    def test_detects_payment_across_bank_and_card(self, db, entity, category, user):
        """
        When a payment of $4499 is made from bank account (bank source),
        and the same $4499 payment appears on credit card statement (card source),
        the duplicate detector should identify them as the same transaction.
        """
        # First transaction: payment from checking account
        tx_bank = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT - CREDIT CARD",
            merchant_normalized="payment - credit card",
            description="Online Payment to Credit Card",
            amount=Decimal("4499.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_fp",
        )
        db.add(tx_bank)
        db.flush()

        # Second transaction: same payment on credit card statement
        # (trying to be imported)
        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 15),
            amount=Decimal("4499.00"),
            source=TransactionSource.card,
            description="Payment - Online Payment",
        )

        assert duplicate is not None, "Should detect cross-source duplicate"
        assert duplicate.id == tx_bank.id

    def test_ignores_non_payment_transactions(self, db, entity, category, user):
        """
        Non-payment transactions with same date/amount should NOT be flagged
        as cross-source duplicates.
        """
        # A regular purchase, not a payment
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="AMAZON",
            merchant_normalized="amazon",
            description="Amazon purchase",
            amount=Decimal("50.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.card,
            fingerprint="amazon_fp",
        )
        db.add(tx)
        db.flush()

        # Try to import a similar amount from bank account but NOT payment-related
        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 15),
            amount=Decimal("50.00"),
            source=TransactionSource.bank,
            description="ATM withdrawal",  # Not a payment keyword
        )

        assert duplicate is None, "Should NOT flag non-payment transactions as duplicates"

    def test_same_source_not_flagged(self, db, entity, category, user):
        """
        Transactions from the same source should not be flagged by cross-source dedup.
        (They should be caught by exact fingerprint dedup instead.)
        """
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT",
            merchant_normalized="payment",
            description="Online Payment",
            amount=Decimal("100.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_fp",
        )
        db.add(tx)
        db.flush()

        # Try to find a duplicate on the same source
        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 15),
            amount=Decimal("100.00"),
            source=TransactionSource.bank,  # Same source
            description="Online Payment",
        )

        assert duplicate is None, "Should not flag same-source duplicates"

    def test_detects_transfer_keyword_payment(self, db, entity, category, user):
        """
        Transactions with 'transfer' keyword should also be detected as cross-source dupes.
        """
        tx_bank = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 20),
            merchant_raw="BANK TRANSFER",
            merchant_normalized="bank transfer",
            description="Wire Transfer Out",
            amount=Decimal("1000.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="transfer_fp",
        )
        db.add(tx_bank)
        db.flush()

        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 20),
            amount=Decimal("1000.00"),
            source=TransactionSource.card,
            description="Transfer received",
        )

        assert duplicate is not None, "Should detect transfer as cross-source duplicate"

    def test_different_amounts_not_matched(self, db, entity, category, user):
        """
        Transactions with different amounts should not be matched.
        """
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT",
            merchant_normalized="payment",
            description="Online Payment",
            amount=Decimal("100.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_fp",
        )
        db.add(tx)
        db.flush()

        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 15),
            amount=Decimal("99.99"),  # Different amount
            source=TransactionSource.card,
            description="Online Payment",
        )

        assert duplicate is None, "Should not match if amounts differ"

    def test_different_dates_not_matched(self, db, entity, category, user):
        """
        Transactions on different dates should not be matched.
        """
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT",
            merchant_normalized="payment",
            description="Online Payment",
            amount=Decimal("100.00"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_fp",
        )
        db.add(tx)
        db.flush()

        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 18),  # Outside 1-day tolerance
            amount=Decimal("100.00"),
            source=TransactionSource.card,
            description="Online Payment",
        )

        assert duplicate is None, "Should not match if dates differ"

    def test_opposite_sign_amount_is_matched(self, db, entity, category, user):
        """
        If sign convention differs across statements (+/-), use absolute amount.
        """
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT",
            merchant_normalized="payment",
            description="Online Payment",
            amount=Decimal("-4499.27"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_signed_fp",
        )
        db.add(tx)
        db.flush()

        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 15),
            amount=Decimal("4499.27"),
            source=TransactionSource.card,
            description="Payment received",
        )

        assert duplicate is not None, "Should match by absolute amount"
        assert duplicate.id == tx.id

    def test_one_day_date_drift_is_matched(self, db, entity, category, user):
        """
        Card/bank posting dates can differ by one day.
        """
        tx = Transaction(
            id=uuid.uuid4(),
            user_id=user.id,
            entity_id=entity.id,
            import_id=uuid.uuid4(),
            transaction_date=date(2026, 3, 15),
            merchant_raw="PAYMENT",
            merchant_normalized="payment",
            description="Online Payment",
            amount=Decimal("4499.27"),
            direction=TransactionDirection.debit,
            currency="USD",
            category_id=category.id,
            source=TransactionSource.bank,
            fingerprint="bank_payment_date_drift_fp",
        )
        db.add(tx)
        db.flush()

        duplicate = find_duplicate_by_cross_source(
            db,
            entity.id,
            transaction_date=date(2026, 3, 16),
            amount=Decimal("4499.27"),
            source=TransactionSource.card,
            description="Online payment",
        )

        assert duplicate is not None, "Should match with one-day date drift"
        assert duplicate.id == tx.id
