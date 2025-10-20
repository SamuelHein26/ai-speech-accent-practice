# routers/sessions.py
from fastapi import APIRouter, Depends
from utils.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("/protected")
async def protected_route(current_user=Depends(get_current_user)):
    return {"message": f"Hello, {current_user.username}! You are authenticated."}
