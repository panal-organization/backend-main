from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, confloat


class AgentAction(str, Enum):
    DRAFT = "draft"
    CLASSIFY = "classify"
    SUMMARY = "summary"


class AgentDecideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    context: list[dict] = Field(default_factory=list, max_length=5)


class AgentDecideResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: AgentAction
    confidence: float = Field(ge=0.0, le=1.0)
