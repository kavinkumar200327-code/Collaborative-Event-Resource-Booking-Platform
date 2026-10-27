from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardStatsResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
)
def get_dashboard_stats(
    organization_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None, description="Simulate dashboard for a specific role (admin, event_manager, staff, participant)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DashboardService(db)
    result = service.get_dashboard_stats(
        user=current_user,
        organization_id=organization_id,
        role_override=role,
    )
    return DashboardStatsResponse(**result)
