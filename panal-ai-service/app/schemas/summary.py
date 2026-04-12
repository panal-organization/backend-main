from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, confloat


class TicketScope(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    GENERIC = "generic"


class SummaryTicket(BaseModel):
    """Input ticket data for summary analysis."""

    titulo: str = Field(min_length=1)
    descripcion: str = Field(min_length=1)
    estado: str
    prioridad: str
    categoria: str


class TicketSummaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tickets: list[SummaryTicket] = Field(min_length=1)
    scope: TicketScope = TicketScope.GENERIC


class TicketSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resumen: str = Field(min_length=1)
    tickets_criticos: int = Field(ge=0)
    problemas_recurrentes: list[str]
    recomendacion: str = Field(min_length=1)
