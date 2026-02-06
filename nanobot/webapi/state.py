"""Shared runtime state for the web API."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class WebAPIState:
    """Container for runtime services used by API routes."""

    config: Any
    bus: Any
    agent: Any
    cron: Any
    heartbeat: Any
    channels: Any
    workspace: Path
    gateway_port: int
    running_jobs: set[str] = field(default_factory=set)

    @property
    def auth_token(self) -> str:
        """Resolve web auth token from env or config."""
        env_token = os.getenv("NANOBOT_WEB_TOKEN", "").strip()
        if env_token:
            return env_token
        return (self.config.gateway.web_token or "").strip()
