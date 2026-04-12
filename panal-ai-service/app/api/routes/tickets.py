from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.classify import TicketClassifyRequest, TicketClassifyResponse
from app.core.security import validate_internal_api_key
from app.schemas.summary import TicketSummaryRequest, TicketSummaryResponse
from app.schemas.tickets import DraftTicketRequest, DraftTicketResponse
from app.services.ticket_ai_service import TicketAIService, TicketAIServiceError
from app.services.ticket_classify_service import (
    TicketClassifyService,
    TicketClassifyServiceError,
)
from app.services.ticket_summary_service import TicketSummaryService, TicketSummaryServiceError

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


@router.post(
    "/summary",
    response_model=TicketSummaryResponse,
    dependencies=[Depends(validate_internal_api_key)],
)
async def summarize_tickets(payload: TicketSummaryRequest) -> TicketSummaryResponse:
    service = TicketSummaryService.from_settings()

    try:
        return await service.generate_summary(payload)
    except TicketSummaryServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ticket summary generation failed: {exc}",
        ) from exc


@router.post(
    "/classify",
    response_model=TicketClassifyResponse,
    dependencies=[Depends(validate_internal_api_key)],
)
async def classify_ticket(payload: TicketClassifyRequest) -> TicketClassifyResponse:
    service = TicketClassifyService.from_settings()

    try:
        return await service.classify_ticket(payload)
    except TicketClassifyServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ticket classification failed: {exc}",
        ) from exc
