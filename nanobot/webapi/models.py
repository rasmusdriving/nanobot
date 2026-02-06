"""Pydantic models for web API requests."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class CronJobCreateRequest(BaseModel):
    """Request payload for creating cron jobs."""

    name: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=5000)
    schedule_kind: Literal["every", "cron", "at"]
    every_seconds: int | None = Field(default=None, ge=1)
    cron_expr: str | None = Field(default=None, min_length=1, max_length=120)
    at_iso: str | None = Field(default=None, min_length=1, max_length=80)
    deliver: bool = False
    channel: str | None = Field(default=None, max_length=64)
    to: str | None = Field(default=None, max_length=128)
    delete_after_run: bool = False


class CronJobPatchRequest(BaseModel):
    """Request payload for patching existing cron jobs."""

    enabled: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    message: str | None = Field(default=None, min_length=1, max_length=5000)
    schedule_kind: Literal["every", "cron", "at"] | None = None
    every_seconds: int | None = Field(default=None, ge=1)
    cron_expr: str | None = Field(default=None, min_length=1, max_length=120)
    at_iso: str | None = Field(default=None, min_length=1, max_length=80)
    delete_after_run: bool | None = None


class HeartbeatFileUpdateRequest(BaseModel):
    """Request payload for updating HEARTBEAT.md."""

    content: str = Field(..., max_length=20000)


class SkillOverride(BaseModel):
    """Per-skill override entry."""

    enabled: bool | None = None
    always: bool | None = None


class SkillSettingsUpdateRequest(BaseModel):
    """Request payload for skill settings updates."""

    skills: dict[str, SkillOverride]


class ConfigUpdateRequest(BaseModel):
    """Request payload for config updates."""

    config: dict[str, Any]
