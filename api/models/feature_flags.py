"""
Pydantic models for Feature Flag responses.
Ensures consistent structure for frontend consumers
and avoids response validation errors upstream.
"""

from typing import Dict, Optional

from pydantic import BaseModel, Field


class FeatureFlagsRolloutInfo(BaseModel):
    """Metadata describing the rollout state of key features."""

    websocket_enabled: bool = Field(..., description="Whether WebSocket execution is active")
    evidence_validation_enabled: bool = Field(..., description="Whether evidence validation is enforced")
    billing_enabled: bool = Field(..., description="Whether billing enforcement is active")
    hmac_enabled: bool = Field(..., description="Whether HMAC security is required")


class FeatureFlagsResponse(BaseModel):
    """Structured response returned to the desktop client."""

    flags: Dict[str, bool] = Field(..., description="Raw feature flag map keyed by flag name")
    user_id: Optional[str] = Field(default=None, description="Optional user identifier if supplied")
    rollout_info: FeatureFlagsRolloutInfo = Field(
        ..., description="Rollout metadata derived from the current flag set"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "flags": {
                    "websocket_execution": False,
                    "evidence_validation": True,
                    "billing_enforcement": False,
                    "hmac_security": True,
                },
                "user_id": "desktop-user",
                "rollout_info": {
                    "websocket_enabled": False,
                    "evidence_validation_enabled": True,
                    "billing_enabled": False,
                    "hmac_enabled": True,
                },
            }
        }
