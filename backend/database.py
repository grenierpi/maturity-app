from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from pathlib import Path

ENV_FILE = Path(__file__).parent / ".env"
DB_PATH  = Path(__file__).parent / "maturity.db"


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str      = f"sqlite:///{DB_PATH}"
    upload_dir: str        = str(Path(__file__).parent / "uploads")
    env: str               = "production"

    class Config:
        env_file = str(ENV_FILE)


settings = Settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_upload_dir():
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


def migrate_db():
    """
    Migration légère — ajoute les colonnes manquantes sans perdre les données.
    Appelé au démarrage de l'app.
    """
    migrations = [
        # (table, colonne, type SQL, valeur défaut)
        ("questions",          "priority",         "VARCHAR",  "'P1'"),
        ("project_templates",  "maturity_minimum", "FLOAT",    "NULL"),
        ("transformation_items","template_id",     "VARCHAR",  "NULL"),
        ("transformation_items","label_custom",    "TEXT",     "NULL"),
        ("transformation_items","description_custom","TEXT",   "NULL"),
        ("transformation_items","start_month",        "VARCHAR","NULL"),
        ("transformation_items","duration_months",    "INTEGER","3"),
        ("transformation_items","phase",              "VARCHAR","'moyen'"),
    ]

    insp = inspect(engine)
    with engine.connect() as conn:
        for table, column, col_type, default in migrations:
            try:
                existing_tables = insp.get_table_names()
                if table not in existing_tables:
                    continue
                existing_cols = [c["name"] for c in insp.get_columns(table)]
                if column not in existing_cols:
                    default_clause = f"DEFAULT {default}" if default != "NULL" else ""
                    conn.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {column} {col_type} {default_clause}"
                    ))
                    conn.commit()
                    print(f"[MIGRATE] Colonne ajoutée : {table}.{column}")
            except Exception as e:
                print(f"[MIGRATE] Warning {table}.{column} : {e}")
