# routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional

from models import User, Session
from schemas import (
    UserCreate,
    UserLogin,
    Token,
    UserResponse,
    UserProfileResponse,
    UserUpdate,
)
from services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from database import get_db

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/register", response_model=Token)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    username_result = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    existing_username = username_result.scalar_one_or_none()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    email_result = await db.execute(select(User).where(User.email == user_data.email))
    existing_email = email_result.scalar_one_or_none()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login_user(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    total_sessions_stmt = (
        select(func.count(Session.id))
        .where(Session.user_id == current_user.id)
    )
    total_sessions_result = await db.execute(total_sessions_stmt)
    total_sessions = total_sessions_result.scalar_one()

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        total_sessions=total_sessions,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    updates: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    has_changes = False

    if updates.username and updates.username != current_user.username:
        username_exists = await db.execute(
            select(User).where(User.username == updates.username, User.id != current_user.id)
        )
        if username_exists.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already exists")
        current_user.username = updates.username
        has_changes = True

    if updates.password:
        current_user.hashed_password = hash_password(updates.password)
        has_changes = True

    if not has_changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    await db.commit()
    await db.refresh(current_user)

    return current_user
