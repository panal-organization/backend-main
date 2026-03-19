from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import validate_internal_api_key
from app.schemas.tickets import DraftTicketRequest, DraftTicketResponse
from app.services.ticket_ai_service import TicketAIService, TicketAIServiceError

router = APIRouter()


@router.post(
    "/draft",
    response_model=DraftTicketResponse,
    dependencies=[Depends(validate_internal_api_key)],
)
async def draft_ticket(payload: DraftTicketRequest) -> DraftTicketResponse:
    service = TicketAIService.from_settings()

    try:
        return await service.generate_ticket_draft(payload)
    except TicketAIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ticket draft generation failed: {exc}",
        ) from exc


# Future endpoints:
# POST /tickets/classify
# POST /tickets/summary
