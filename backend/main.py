from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, init_upload_dir, migrate_db
from routers import framework, campaigns, interview, synthesis, templates, plan, framework_admin, assessment, gantt, sheets

app = FastAPI(
    title       = "Maturity Assessment API",
    description = "API pour l'évaluation de maturité fournisseur",
    version     = "0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    migrate_db()
    init_upload_dir()


app.include_router(framework.router)
app.include_router(campaigns.router)
app.include_router(interview.router)
app.include_router(synthesis.router)
app.include_router(templates.router)
app.include_router(plan.router)
app.include_router(framework_admin.router)
app.include_router(assessment.router)
app.include_router(gantt.router)
app.include_router(sheets.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
