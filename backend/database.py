import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL for async engine
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env file")

# Create asynchronous SQLAlchemy engine
engine = create_async_engine(DATABASE_URL, echo=True, future=True)

# Define async session factory
SessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# Declarative base for ORM models
Base = declarative_base()

# Dependency injection helper for FastAPI endpoints
async def get_db():
    async with SessionLocal() as session:
        yield session