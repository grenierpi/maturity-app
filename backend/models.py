from datetime import datetime
from uuid import uuid4
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, JSON, UniqueConstraint, CheckConstraint, Text
)
from sqlalchemy.orm import relationship
from database import Base


def new_uuid():
    return str(uuid4())


# ─── FRAMEWORK (lecture seule après seed) ────────────────────────────────────

class Domain(Base):
    __tablename__ = "domains"
    id          = Column(String, primary_key=True, default=new_uuid)
    code        = Column(String, unique=True, nullable=False)
    label       = Column(String, nullable=False)
    weight      = Column(Float, default=1.0)
    order_index = Column(Integer, nullable=False)
    subdomains  = relationship(
        "Subdomain", back_populates="domain",
        order_by="Subdomain.order_index", cascade="all, delete-orphan"
    )


class Subdomain(Base):
    __tablename__ = "subdomains"
    id          = Column(String, primary_key=True, default=new_uuid)
    domain_id   = Column(String, ForeignKey("domains.id"), nullable=False)
    code        = Column(String, unique=True, nullable=False)
    label       = Column(String, nullable=False)
    weight      = Column(Float, default=1.0)
    order_index = Column(Integer, nullable=False)
    domain      = relationship("Domain", back_populates="subdomains")
    questions   = relationship(
        "Question", back_populates="subdomain",
        order_by="Question.order_index", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"
    id           = Column(String, primary_key=True, default=new_uuid)
    subdomain_id = Column(String, ForeignKey("subdomains.id"), nullable=False)
    text         = Column(Text, nullable=False)
    guidance     = Column(Text)
    order_index  = Column(Integer, nullable=False)
    priority     = Column(String, default="P1")  # P0 | P1 | P2
    subdomain    = relationship("Subdomain", back_populates="questions")
    criteria     = relationship(
        "Criterion", back_populates="question",
        order_by="Criterion.order_index", cascade="all, delete-orphan"
    )


class Criterion(Base):
    __tablename__ = "criteria"
    id                   = Column(String, primary_key=True, default=new_uuid)
    question_id          = Column(String, ForeignKey("questions.id"), nullable=False)
    text                 = Column(Text, nullable=False)
    verification_hint    = Column(Text)
    weight               = Column(Float, default=1.0)
    order_index          = Column(Integer, nullable=False)
    effort_default       = Column(String, default="moyen")
    impact_default       = Column(String, default="moyen")
    recommendation_label = Column(Text)
    question             = relationship("Question", back_populates="criteria")


# ─── OPÉRATIONNEL ────────────────────────────────────────────────────────────

class Supplier(Base):
    __tablename__ = "suppliers"
    id         = Column(String, primary_key=True, default=new_uuid)
    name       = Column(String, nullable=False)
    sector     = Column(String)
    country    = Column(String, default="FR")
    created_at = Column(DateTime, default=datetime.utcnow)
    campaigns  = relationship("Campaign", back_populates="supplier")


class Campaign(Base):
    __tablename__ = "campaigns"
    id                   = Column(String, primary_key=True, default=new_uuid)
    supplier_id          = Column(String, ForeignKey("suppliers.id"), nullable=False)
    title                = Column(String, nullable=False)
    consultant_name      = Column(String)
    status               = Column(String, default="DRAFT")
    domain_scope         = Column(JSON, nullable=False)
    synthesis_notes      = Column(Text)
    report_generated_at  = Column(DateTime)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, onupdate=datetime.utcnow)
    supplier             = relationship("Supplier", back_populates="campaigns")
    criterion_responses  = relationship(
        "CriterionResponse", back_populates="campaign",
        cascade="all, delete-orphan"
    )
    subdomain_scores     = relationship(
        "SubdomainScore", back_populates="campaign",
        cascade="all, delete-orphan"
    )
    transformation_items = relationship(
        "TransformationItem", back_populates="campaign",
        cascade="all, delete-orphan"
    )


class CriterionResponse(Base):
    __tablename__ = "criterion_responses"
    id           = Column(String, primary_key=True, default=new_uuid)
    campaign_id  = Column(String, ForeignKey("campaigns.id"), nullable=False)
    criterion_id = Column(String, ForeignKey("criteria.id"), nullable=False)
    score        = Column(Integer, nullable=True)
    comment      = Column(Text)
    flagged      = Column(Boolean, default=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    campaign     = relationship("Campaign", back_populates="criterion_responses")
    criterion    = relationship("Criterion")
    proofs       = relationship(
        "Proof", back_populates="response",
        cascade="all, delete-orphan"
    )
    __table_args__ = (
        UniqueConstraint("campaign_id", "criterion_id"),
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 4)"),
    )


class Proof(Base):
    __tablename__ = "proofs"
    id           = Column(String, primary_key=True, default=new_uuid)
    response_id  = Column(String, ForeignKey("criterion_responses.id"), nullable=False)
    filename     = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    mime_type    = Column(String)
    uploaded_at  = Column(DateTime, default=datetime.utcnow)
    response     = relationship("CriterionResponse", back_populates="proofs")


class SubdomainScore(Base):
    __tablename__ = "subdomain_scores"
    id               = Column(String, primary_key=True, default=new_uuid)
    campaign_id      = Column(String, ForeignKey("campaigns.id"), nullable=False)
    subdomain_id     = Column(String, ForeignKey("subdomains.id"), nullable=False)
    score_computed   = Column(Float)
    score_target     = Column(Float, default=3.0)
    questions_total  = Column(Integer, default=0)
    questions_scored = Column(Integer, default=0)
    computed_at      = Column(DateTime, default=datetime.utcnow)
    campaign         = relationship("Campaign", back_populates="subdomain_scores")
    subdomain        = relationship("Subdomain")
    __table_args__ = (
        UniqueConstraint("campaign_id", "subdomain_id"),
    )


class TransformationItem(Base):
    __tablename__ = "transformation_items"
    id                   = Column(String, primary_key=True, default=new_uuid)
    campaign_id          = Column(String, ForeignKey("campaigns.id"), nullable=False)
    template_id          = Column(String, ForeignKey("project_templates.id"), nullable=True)
    source               = Column(String, default="llm")  # llm|template|manual
    recommendation_label = Column(Text, nullable=False)
    description          = Column(Text)
    domain_codes         = Column(JSON)
    subdomain_codes      = Column(JSON)
    effort               = Column(String)
    impact               = Column(String)
    priority_rank        = Column(Integer)
    status               = Column(String, default="proposed")
    exclusion_reason     = Column(String)
    label_custom         = Column(Text)
    description_custom   = Column(Text)
    # Planning Gantt
    start_month          = Column(String, nullable=True)   # "YYYY-MM"
    duration_months      = Column(Integer, default=3)
    phase                = Column(String, default="moyen") # quick_win|court|moyen|long
    created_at           = Column(DateTime, default=datetime.utcnow)
    campaign             = relationship("Campaign", back_populates="transformation_items")
    template             = relationship("ProjectTemplate", back_populates="items", foreign_keys=[template_id])


# ─── CATALOGUE DE CHANTIERS (réutilisable multi-campagnes) ───────────────────

class ProjectTemplate(Base):
    """Chantier générique du catalogue — indépendant de toute campagne."""
    __tablename__ = "project_templates"
    id               = Column(String, primary_key=True, default=new_uuid)
    label            = Column(Text, nullable=False)
    description      = Column(Text)
    effort_default   = Column(String, default="moyen")
    impact_default   = Column(String, default="moyen")
    source           = Column(String, default="manual")  # manual|llm|seed
    active           = Column(Boolean, default=True)
    maturity_minimum = Column(Float, nullable=True)  # score as-is min requis (0-4)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, onupdate=datetime.utcnow)
    impacts        = relationship(
        "ProjectTemplateImpact", back_populates="template",
        cascade="all, delete-orphan"
    )
    items          = relationship("TransformationItem", back_populates="template")


class ProjectTemplateImpact(Base):
    """Gain de maturité attendu d'un chantier sur un sous-domaine donné."""
    __tablename__ = "project_template_impacts"
    id            = Column(String, primary_key=True, default=new_uuid)
    template_id   = Column(String, ForeignKey("project_templates.id"), nullable=False)
    subdomain_id  = Column(String, ForeignKey("subdomains.id"), nullable=False)
    maturity_target = Column(Float, nullable=False)
    template      = relationship("ProjectTemplate", back_populates="impacts")
    subdomain     = relationship("Subdomain")
    __table_args__ = (UniqueConstraint("template_id", "subdomain_id"),)


class ProjectTemplateSheet(Base):
    """Fiche chantier — liée à un ProjectTemplate, réutilisable sur toutes les campagnes."""
    __tablename__ = "project_template_sheets"
    id              = Column(String, primary_key=True, default=new_uuid)
    template_id     = Column(String, ForeignKey("project_templates.id"), nullable=False, unique=True)
    objectives      = Column(Text)
    key_actions     = Column(JSON, default=list)   # ["action 1", "action 2", ...]
    stakeholders    = Column(JSON, default=list)   # ["DG", "Responsable SC", ...]
    prerequisites   = Column(Text)
    deliverables    = Column(JSON, default=list)
    success_kpis    = Column(JSON, default=list)
    duration_hint   = Column(String)               # "3-6 mois"
    generated_by_ai = Column(Boolean, default=False)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    template        = relationship("ProjectTemplate", backref="sheet", uselist=False)
