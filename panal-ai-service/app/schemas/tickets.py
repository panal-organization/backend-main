from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, confloat


class TicketPriority(str, Enum):
    BAJA = "BAJA"
    ALTA = "ALTA"
    CRITICA = "CRITICA"


class TicketCategory(str, Enum):
    SOPORTE = "SOPORTE"
    MEJORA = "MEJORA"


class DraftTicketRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    workspace_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    allowed_priorities: list[TicketPriority] = Field(min_length=1)
    allowed_categories: list[TicketCategory] = Field(min_length=1)


class DraftTicketResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(min_length=1)
    descripcion: str = Field(min_length=1)
    prioridad: TicketPriority
    categoria: TicketCategory
    tags: list[str]
    confidence: confloat(ge=0.0, le=1.0)
