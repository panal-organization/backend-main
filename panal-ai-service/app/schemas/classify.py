from pydantic import BaseModel, ConfigDict, Field, confloat

from app.schemas.tickets import TicketCategory, TicketPriority


class TicketClassifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    titulo: str | None = None
    descripcion: str = Field(min_length=1)


class TicketClassifyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prioridad: TicketPriority
    categoria: TicketCategory
    justificacion: str = Field(min_length=1)
    confidence: confloat(ge=0.0, le=1.0)
