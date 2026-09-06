from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from sqlalchemy import inspect, text

    from app.models import entities  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Lightweight additive columns for existing SQLite/Postgres DBs (no Alembic yet).
    inspector = inspect(engine)
    if "trade_packs" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("trade_packs")}
    alters: list[str] = []
    if "progress_stage" not in existing:
        alters.append("ALTER TABLE trade_packs ADD COLUMN progress_stage VARCHAR(64)")
    if "progress_current" not in existing:
        alters.append("ALTER TABLE trade_packs ADD COLUMN progress_current INTEGER DEFAULT 0")
    if "progress_total" not in existing:
        alters.append("ALTER TABLE trade_packs ADD COLUMN progress_total INTEGER DEFAULT 0")
    if "progress_message" not in existing:
        alters.append("ALTER TABLE trade_packs ADD COLUMN progress_message VARCHAR(256)")
    if alters:
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))
