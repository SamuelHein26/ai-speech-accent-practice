import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL for async engine
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ai_user:Password123@localhost:5432/ai_speech_training"
)

# Create asynchronous SQLAlchemy engine
engine = create_async_engine(DATABASE_URL, echo=True, future=True)

# Define async session factory
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# Declarative base for ORM models
Base = declarative_base()

# Dependency injection helper for FastAPI endpoints
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session