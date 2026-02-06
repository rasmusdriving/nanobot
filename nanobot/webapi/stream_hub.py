"""WebSocket hub for streaming agent runs."""

import asyncio
import uuid
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket

from nanobot.webapi.state import WebAPIState


class StreamHub:
    """Coordinates WebSocket clients and streamed agent events."""

    def __init__(self, state: WebAPIState):
        self.state = state
        self._clients: set[WebSocket] = set()
        self._subscriptions: dict[WebSocket, set[str]] = {}
        self._run_tasks: dict[str, asyncio.Task] = {}
        self._run_owner: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def add_client(self, websocket: WebSocket) -> None:
        """Register a connected websocket."""
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)
            self._subscriptions[websocket] = set()

    async def remove_client(self, websocket: WebSocket) -> None:
        """Unregister a websocket and cancel owned runs."""
        async with self._lock:
            self._clients.discard(websocket)
            self._subscriptions.pop(websocket, None)
            owned = [rid for rid, owner in self._run_owner.items() if owner == websocket]
        for run_id in owned:
            self.state.agent.cancel_stream_run(run_id)
            task = self._run_tasks.get(run_id)
            if task:
                task.cancel()

    async def handle_event(self, websocket: WebSocket, event: dict[str, Any]) -> None:
        """Handle an incoming websocket event."""
        event_type = event.get("type")
        if event_type == "chat.send":
            await self._start_run(websocket, event)
            return
        if event_type == "chat.cancel":
            run_id = str(event.get("run_id", "")).strip()
            if run_id:
                self.state.agent.cancel_stream_run(run_id)
            return
        if event_type == "session.subscribe":
            sessions = event.get("session_key")
            await self._update_subscriptions(websocket, [sessions] if isinstance(sessions, str) else [])
            return
        if event_type == "ping":
            await self._safe_send(websocket, {"type": "pong"})

    async def _update_subscriptions(self, websocket: WebSocket, keys: Iterable[str]) -> None:
        """Replace websocket session subscriptions."""
        async with self._lock:
            self._subscriptions[websocket] = {k for k in keys if isinstance(k, str) and k.strip()}

    async def _start_run(self, websocket: WebSocket, event: dict[str, Any]) -> None:
        """Start streaming a direct agent run for one websocket."""
        content = str(event.get("content", "")).strip()
        session_key = str(event.get("session_key", "")).strip()
        if not content or not session_key:
            await self._safe_send(websocket, {"type": "agent.error", "message": "content and session_key are required"})
            return
        channel = str(event.get("channel", "cli"))
        chat_id = str(event.get("chat_id", "web"))
        run_id = str(event.get("run_id", "")).strip() or uuid.uuid4().hex[:10]
        await self._safe_send(websocket, {"type": "chat.ack", "run_id": run_id, "session_key": session_key})
        task = asyncio.create_task(
            self._run_stream(websocket, run_id, content, session_key, channel, chat_id)
        )
        async with self._lock:
            self._run_tasks[run_id] = task
            self._run_owner[run_id] = websocket

    async def _run_stream(
        self,
        websocket: WebSocket,
        run_id: str,
        content: str,
        session_key: str,
        channel: str,
        chat_id: str,
    ) -> None:
        """Pump streamed events from AgentLoop to websocket."""
        self.state.running_jobs.add(run_id)
        try:
            async for server_event in self.state.agent.process_direct_stream(
                content=content,
                session_key=session_key,
                channel=channel,
                chat_id=chat_id,
                run_id=run_id,
            ):
                await self._safe_send(websocket, server_event)
                if server_event.get("type") == "session.updated":
                    await self._broadcast_session_update(server_event)
        except Exception as exc:  # pragma: no cover - websocket/runtime safety
            await self._safe_send(websocket, {"type": "agent.error", "run_id": run_id, "message": str(exc)})
        finally:
            self.state.running_jobs.discard(run_id)
            async with self._lock:
                self._run_tasks.pop(run_id, None)
                self._run_owner.pop(run_id, None)

    async def _broadcast_session_update(self, event: dict[str, Any]) -> None:
        """Broadcast session update events to subscribed clients."""
        session_key = str(event.get("session_key", "")).strip()
        if not session_key:
            return
        async with self._lock:
            clients = list(self._clients)
            subscriptions = {client: self._subscriptions.get(client, set()) for client in clients}
        for client in clients:
            watch = subscriptions.get(client, set())
            if not watch or session_key in watch:
                await self._safe_send(client, event)

    async def _safe_send(self, websocket: WebSocket, payload: dict[str, Any]) -> None:
        """Send JSON payload safely, dropping dead sockets."""
        try:
            await websocket.send_json(payload)
        except Exception:
            await self.remove_client(websocket)
