from app.routers.imports import router as imports_router
from app.routers.transactions import router as transactions_router
from app.routers.receipts import router as receipts_router
from app.routers.analytics import router as analytics_router
from app.routers.goals import router as goals_router
from app.routers.accounts import router as accounts_router
from app.routers.plaid import router as plaid_router

__all__ = [
    "imports_router",
    "transactions_router",
    "receipts_router",
    "analytics_router",
    "goals_router",
    "accounts_router",
    "plaid_router",
]
