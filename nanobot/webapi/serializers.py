"""Serialization helpers for web API responses."""

from datetime import datetime
from pathlib import Path
from typing import Any

from nanobot.cron.types import CronSchedule


def cron_job_to_dict(job: Any) -> dict[str, Any]:
    """Serialize a cron job dataclass."""
    return {
        "id": job.id,
        "name": job.name,
        "enabled": job.enabled,
        "schedule": {
            "kind": job.schedule.kind,
            "atMs": job.schedule.at_ms,
            "everyMs": job.schedule.every_ms,
            "expr": job.schedule.expr,
            "tz": job.schedule.tz,
        },
        "payload": {
            "kind": job.payload.kind,
            "message": job.payload.message,
            "deliver": job.payload.deliver,
            "channel": job.payload.channel,
            "to": job.payload.to,
        },
        "state": {
            "nextRunAtMs": job.state.next_run_at_ms,
            "lastRunAtMs": job.state.last_run_at_ms,
            "lastStatus": job.state.last_status,
            "lastError": job.state.last_error,
        },
        "createdAtMs": job.created_at_ms,
        "updatedAtMs": job.updated_at_ms,
        "deleteAfterRun": job.delete_after_run,
    }


def build_schedule(
    kind: str | None,
    every_seconds: int | None,
    cron_expr: str | None,
    at_iso: str | None,
    fallback: CronSchedule | None = None,
) -> CronSchedule:
    """Build a CronSchedule from request fields."""
    schedule_kind = kind or (fallback.kind if fallback else None)
    if schedule_kind == "every":
        if every_seconds is None:
            every_seconds = (fallback.every_ms // 1000) if fallback and fallback.every_ms else None
        if not every_seconds:
            raise ValueError("every_seconds is required for schedule_kind='every'")
        return CronSchedule(kind="every", every_ms=every_seconds * 1000)
    if schedule_kind == "cron":
        expr = cron_expr or (fallback.expr if fallback else None)
        if not expr:
            raise ValueError("cron_expr is required for schedule_kind='cron'")
        return CronSchedule(kind="cron", expr=expr)
    if schedule_kind == "at":
        value = at_iso
        if not value and fallback and fallback.at_ms:
            value = datetime.fromtimestamp(fallback.at_ms / 1000).isoformat()
        if not value:
            raise ValueError("at_iso is required for schedule_kind='at'")
        at_ms = int(datetime.fromisoformat(value).timestamp() * 1000)
        return CronSchedule(kind="at", at_ms=at_ms)
    raise ValueError("schedule_kind must be one of: every, cron, at")


def session_key_from_path(path: Path) -> str:
    """Derive session key from filename convention."""
    return path.stem.replace("_", ":")
