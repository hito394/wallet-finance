from fastapi import APIRouter

from app.api.routes.analytics import router as analytics_router
from app.api.routes.documents import router as documents_router
from app.api.routes.entities import router as entities_router
from app.api.routes.exports import router as exports_router
from app.api.routes.imports import router as imports_router
from app.api.routes.learning import router as learning_router
from app.api.routes.review import router as review_router
from app.api.routes.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(entities_router, prefix="/entities", tags=["entities"])
api_router.include_router(imports_router, prefix="/imports", tags=["imports"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(review_router, prefix="/review-queue", tags=["review"])
api_router.include_router(learning_router, prefix="/learning", tags=["learning"])
api_router.include_router(exports_router, prefix="/exports", tags=["exports"])
