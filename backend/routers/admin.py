from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PracticeAttempt, Session, User
from schemas import AdminOverview
from services.auth_service import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/overview", response_model=AdminOverview)
async def get_overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stats = await db.execute(select(
        select(func.count()).select_from(User).scalar_subquery(),
        select(func.count()).select_from(User)
        .where(User.role.in_(("admin", "primary_admin"))).scalar_subquery(),
        select(func.count()).select_from(Session).scalar_subquery(),
        select(func.count()).select_from(PracticeAttempt).scalar_subquery(),
    ))
    users, admins, monologue_sessions, accent_attempts = stats.one()
    return AdminOverview(
        role=admin.role,
        users=users,
        admins=admins,
        monologue_sessions=monologue_sessions,
        accent_attempts=accent_attempts,
    )
