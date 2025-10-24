# Purpose: single source of truth for SQLAlchemy Base, no engine here.
from sqlalchemy.orm import declarative_base
Base = declarative_base()
