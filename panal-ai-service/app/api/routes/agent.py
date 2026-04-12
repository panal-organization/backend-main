from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import validate_internal_api_key
from app.schemas.agent import AgentDecideRequest, AgentDecideResponse
from app.services.agent_ai_service import AgentAIService, AgentAIServiceError

router = APIRouter()


@router.post(
    "/decide",
    response_model=AgentDecideResponse,
    dependencies=[Depends(validate_internal_api_key)],
)
async def decide_agent_action(payload: AgentDecideRequest) -> AgentDecideResponse:
    service = AgentAIService.from_settings()

    try:
        return await service.decide_action(payload)
    except AgentAIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Agent decision failed: {exc}",
        ) from exc
