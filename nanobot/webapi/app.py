"""FastAPI application for the nanobot control room."""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from nanobot.config.loader import save_config
from nanobot.cron.service import _compute_next_run
from nanobot.webapi.auth import parse_bearer_token, verify_token, ws_authenticate
from nanobot.webapi.config_ops import build_updated_config, config_to_masked_payload
from nanobot.webapi.models import (
    ConfigUpdateRequest,
    CronJobCreateRequest,
    CronJobPatchRequest,
    HeartbeatFileUpdateRequest,
    SkillSettingsUpdateRequest,
)
from nanobot.webapi.serializers import build_schedule, cron_job_to_dict
from nanobot.webapi.state import WebAPIState
from nanobot.webapi.stream_hub import StreamHub


def create_web_app(state: WebAPIState) -> FastAPI:
    """Create the web API app bound to runtime services."""
    app = FastAPI(title="nanobot control room", version="0.1.0")
    hub = StreamHub(state)

    async def require_auth(authorization: str | None = Header(default=None)) -> None:
        verify_token(state.auth_token, parse_bearer_token(authorization))

    @app.get("/api/v1/status", dependencies=[Depends(require_auth)])
    async def get_status() -> dict[str, Any]:
        heartbeat_file = state.heartbeat.heartbeat_file
        return {
            "gatewayPort": state.gateway_port,
            "workspace": str(state.workspace),
            "queues": {"inbound": state.bus.inbound_size, "outbound": state.bus.outbound_size},
            "cron": state.cron.status(),
            "heartbeat": {
                "enabled": state.heartbeat.enabled,
                "intervalSeconds": state.heartbeat.interval_s,
                "fileExists": heartbeat_file.exists(),
            },
            "channels": state.channels.get_status() if state.channels else {},
            "activeRuns": len(state.running_jobs),
        }

    @app.get("/api/v1/sessions", dependencies=[Depends(require_auth)])
    async def list_sessions() -> dict[str, Any]:
        sessions = state.agent.sessions.list_sessions()
        return {"sessions": sessions}

    @app.get("/api/v1/sessions/{session_key:path}", dependencies=[Depends(require_auth)])
    async def get_session(session_key: str) -> dict[str, Any]:
        manager = state.agent.sessions
        path = manager._get_session_path(session_key)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Session not found")
        session = manager._load(session_key)
        if not session:
            raise HTTPException(status_code=500, detail="Failed to load session")
        return {
            "key": session.key,
            "createdAt": session.created_at.isoformat(),
            "updatedAt": session.updated_at.isoformat(),
            "metadata": session.metadata,
            "messages": session.messages,
            "path": str(path),
        }

    @app.delete("/api/v1/sessions/{session_key:path}", dependencies=[Depends(require_auth)])
    async def delete_session(session_key: str) -> dict[str, Any]:
        deleted = state.agent.sessions.delete(session_key)
        if not deleted:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"ok": True}

    @app.get("/api/v1/cron/jobs", dependencies=[Depends(require_auth)])
    async def list_cron_jobs() -> dict[str, Any]:
        jobs = [cron_job_to_dict(job) for job in state.cron.list_jobs(include_disabled=True)]
        return {"jobs": jobs}

    @app.post("/api/v1/cron/jobs", dependencies=[Depends(require_auth)])
    async def create_cron_job(payload: CronJobCreateRequest) -> dict[str, Any]:
        try:
            schedule = build_schedule(
                kind=payload.schedule_kind,
                every_seconds=payload.every_seconds,
                cron_expr=payload.cron_expr,
                at_iso=payload.at_iso,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        job = state.cron.add_job(
            name=payload.name,
            schedule=schedule,
            message=payload.message,
            deliver=payload.deliver,
            channel=payload.channel,
            to=payload.to,
            delete_after_run=payload.delete_after_run,
        )
        return {"job": cron_job_to_dict(job)}

    @app.patch("/api/v1/cron/jobs/{job_id}", dependencies=[Depends(require_auth)])
    async def patch_cron_job(job_id: str, payload: CronJobPatchRequest) -> dict[str, Any]:
        store = state.cron._load_store()
        job = next((j for j in store.jobs if j.id == job_id), None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if payload.name is not None:
            job.name = payload.name
        if payload.message is not None:
            job.payload.message = payload.message
        if payload.delete_after_run is not None:
            job.delete_after_run = payload.delete_after_run
        schedule_changed = any(
            value is not None
            for value in (payload.schedule_kind, payload.every_seconds, payload.cron_expr, payload.at_iso)
        )
        if schedule_changed:
            try:
                job.schedule = build_schedule(
                    kind=payload.schedule_kind,
                    every_seconds=payload.every_seconds,
                    cron_expr=payload.cron_expr,
                    at_iso=payload.at_iso,
                    fallback=job.schedule,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        if payload.enabled is not None:
            job.enabled = payload.enabled
        now_ms = int(time.time() * 1000)
        job.updated_at_ms = now_ms
        job.state.next_run_at_ms = _compute_next_run(job.schedule, now_ms) if job.enabled else None
        state.cron._save_store()
        state.cron._arm_timer()
        return {"job": cron_job_to_dict(job)}

    @app.post("/api/v1/cron/jobs/{job_id}/run", dependencies=[Depends(require_auth)])
    async def run_cron_job(job_id: str) -> dict[str, Any]:
        ok = await state.cron.run_job(job_id, force=True)
        if not ok:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"ok": True}

    @app.delete("/api/v1/cron/jobs/{job_id}", dependencies=[Depends(require_auth)])
    async def delete_cron_job(job_id: str) -> dict[str, Any]:
        ok = state.cron.remove_job(job_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"ok": True}

    @app.get("/api/v1/heartbeat", dependencies=[Depends(require_auth)])
    async def get_heartbeat() -> dict[str, Any]:
        content = state.heartbeat._read_heartbeat_file() or ""
        return {
            "enabled": state.heartbeat.enabled,
            "intervalSeconds": state.heartbeat.interval_s,
            "path": str(state.heartbeat.heartbeat_file),
            "content": content,
        }

    @app.put("/api/v1/heartbeat/file", dependencies=[Depends(require_auth)])
    async def update_heartbeat(payload: HeartbeatFileUpdateRequest) -> dict[str, Any]:
        max_bytes = state.config.gateway.web_max_heartbeat_file_bytes
        content_bytes = payload.content.encode("utf-8")
        if len(content_bytes) > max_bytes:
            raise HTTPException(status_code=400, detail=f"Content exceeds {max_bytes} bytes")
        state.heartbeat.heartbeat_file.parent.mkdir(parents=True, exist_ok=True)
        state.heartbeat.heartbeat_file.write_text(payload.content, encoding="utf-8")
        return {"ok": True, "bytes": len(content_bytes)}

    @app.post("/api/v1/heartbeat/trigger", dependencies=[Depends(require_auth)])
    async def trigger_heartbeat() -> dict[str, Any]:
        response = await state.heartbeat.trigger_now()
        return {"ok": True, "response": response}

    @app.get("/api/v1/skills", dependencies=[Depends(require_auth)])
    async def list_skills() -> dict[str, Any]:
        loader = state.agent.context.skills
        skills = []
        for skill in loader.list_skills(filter_unavailable=False, include_disabled=True):
            name = str(skill["name"])
            skill_meta = loader._get_skill_meta(name)
            skills.append({
                "name": name,
                "path": skill["path"],
                "source": skill["source"],
                "enabled": skill.get("enabled", True),
                "always": skill.get("always"),
                "description": loader._get_skill_description(name),
                "available": bool(skill.get("enabled", True) and loader._check_requirements(skill_meta)),
            })
        return {"skills": skills, "settings": loader.get_skill_settings()}

    @app.put("/api/v1/skills/settings", dependencies=[Depends(require_auth)])
    async def update_skill_settings(payload: SkillSettingsUpdateRequest) -> dict[str, Any]:
        loader = state.agent.context.skills
        current = loader.get_skill_settings()
        for name, setting in payload.skills.items():
            current[name] = {"enabled": setting.enabled, "always": setting.always}
        settings = loader.save_skill_settings(current)
        return {"settings": settings}

    @app.get("/api/v1/config", dependencies=[Depends(require_auth)])
    async def get_config() -> dict[str, Any]:
        return {"config": config_to_masked_payload(state.config)}

    @app.put("/api/v1/config", dependencies=[Depends(require_auth)])
    async def update_config(payload: ConfigUpdateRequest) -> dict[str, Any]:
        updated_config = build_updated_config(state.config, payload.config)
        save_config(updated_config)
        state.config = updated_config
        return {"ok": True, "config": config_to_masked_payload(updated_config), "restartRequired": True}

    @app.websocket("/api/v1/stream")
    async def stream_socket(websocket: WebSocket) -> None:
        if not await ws_authenticate(websocket, state.auth_token):
            return
        await hub.add_client(websocket)
        try:
            while True:
                message = await websocket.receive_text()
                try:
                    event = json.loads(message)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "agent.error", "message": "Invalid JSON payload"})
                    continue
                if not isinstance(event, dict):
                    await websocket.send_json({"type": "agent.error", "message": "Event must be an object"})
                    continue
                await hub.handle_event(websocket, event)
        except WebSocketDisconnect:
            await hub.remove_client(websocket)
        except Exception as exc:  # pragma: no cover - socket safety
            await hub.remove_client(websocket)
            try:
                await websocket.close(code=1011, reason=str(exc))
            except Exception:
                pass

    @app.get("/healthz")
    async def healthz() -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"ok": True, "time": datetime.now().isoformat()})

    _mount_frontend_dist(app)
    return app


def _mount_frontend_dist(app: FastAPI) -> None:
    """Serve built frontend assets when available."""
    root = Path(__file__).resolve().parents[2]
    dist = root / "web" / "dist"
    if dist.exists():
        app.mount("/", StaticFiles(directory=dist, html=True), name="control-room")
        return

    @app.get("/", include_in_schema=False)
    async def frontend_unavailable() -> HTMLResponse:
        html = """
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h1>Pobot Control Room</h1>
            <p>Frontend build not found.</p>
            <pre>cd web && npm install && npm run build</pre>
          </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=200)
