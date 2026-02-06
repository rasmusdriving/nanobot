"""Streaming helpers for the agent loop."""

import json
from collections.abc import AsyncIterator
from typing import Any

from nanobot.providers.base import LLMResponse


def _set_tool_contexts(agent: Any, channel: str, chat_id: str) -> None:
    """Set channel/chat context on context-aware tools."""
    message_tool = agent.tools.get("message")
    if message_tool and hasattr(message_tool, "set_context"):
        message_tool.set_context(channel, chat_id)
    spawn_tool = agent.tools.get("spawn")
    if spawn_tool and hasattr(spawn_tool, "set_context"):
        spawn_tool.set_context(channel, chat_id)
    cron_tool = agent.tools.get("cron")
    if cron_tool and hasattr(cron_tool, "set_context"):
        cron_tool.set_context(channel, chat_id)


def _build_tool_call_dicts(response: LLMResponse) -> list[dict[str, Any]]:
    """Convert tool calls to OpenAI-style message payloads."""
    return [
        {
            "id": tc.id,
            "type": "function",
            "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
        }
        for tc in response.tool_calls
    ]


def _preview(value: Any, max_len: int = 500) -> str:
    """Build a compact preview string for tool results."""
    text = str(value)
    return text if len(text) <= max_len else f"{text[: max_len - 3]}..."


async def _collect_streamed_response(agent: Any, messages: list[dict[str, Any]]) -> tuple[LLMResponse, list[str]]:
    """Collect streamed deltas and return a normalized response."""
    deltas: list[str] = []
    response: LLMResponse | None = None
    stream_error = ""

    async for event in agent.provider.chat_stream(
        messages=messages,
        tools=agent.tools.get_definitions(),
        model=agent.model,
    ):
        event_type = event.get("type")
        if event_type == "delta":
            text = event.get("text")
            if isinstance(text, str) and text:
                deltas.append(text)
        elif event_type == "done":
            candidate = event.get("response")
            if isinstance(candidate, LLMResponse):
                response = candidate
        elif event_type == "error":
            stream_error = str(event.get("message", "streaming failed"))
            break

    if response:
        return response, deltas

    fallback = await agent.provider.chat(
        messages=messages,
        tools=agent.tools.get_definitions(),
        model=agent.model,
    )
    if stream_error:
        fallback.content = fallback.content or f"Error calling LLM: {stream_error}"
    return fallback, deltas


async def stream_direct_response(
    agent: Any,
    content: str,
    session_key: str,
    channel: str,
    chat_id: str,
    run_id: str,
) -> AsyncIterator[dict[str, Any]]:
    """Stream direct agent responses with tool execution events."""
    session = agent.sessions.get_or_create(session_key)
    _set_tool_contexts(agent, channel, chat_id)
    messages = agent.context.build_messages(
        history=session.get_history(),
        current_message=content,
        channel=channel,
        chat_id=chat_id,
    )

    final_content = ""
    final_usage: dict[str, int] = {}
    for _ in range(agent.max_iterations):
        if agent.is_stream_run_cancelled(run_id):
            yield {"type": "agent.error", "run_id": run_id, "message": "Run cancelled"}
            agent.clear_stream_run(run_id)
            return

        response, deltas = await _collect_streamed_response(agent, messages)
        for delta in deltas:
            yield {"type": "chat.delta", "run_id": run_id, "text_delta": delta}
        final_usage = response.usage or final_usage

        if response.has_tool_calls:
            tool_calls = _build_tool_call_dicts(response)
            messages = agent.context.add_assistant_message(
                messages,
                response.content,
                tool_calls,
                assistant_message=response.assistant_message,
            )
            for tool_call in response.tool_calls:
                if agent.is_stream_run_cancelled(run_id):
                    yield {"type": "agent.error", "run_id": run_id, "message": "Run cancelled"}
                    agent.clear_stream_run(run_id)
                    return
                yield {
                    "type": "tool.start",
                    "run_id": run_id,
                    "tool_name": tool_call.name,
                    "args": tool_call.arguments,
                }
                try:
                    result = await agent.tools.execute(tool_call.name, tool_call.arguments)
                    ok = True
                except Exception as exc:  # pragma: no cover - defensive
                    result = f"Tool execution failed: {exc}"
                    ok = False
                yield {
                    "type": "tool.end",
                    "run_id": run_id,
                    "tool_name": tool_call.name,
                    "result_preview": _preview(result),
                    "ok": ok,
                }
                messages = agent.context.add_tool_result(messages, tool_call.id, tool_call.name, str(result))
            continue

        final_content = response.content or "".join(deltas)
        break

    if not final_content:
        final_content = "I've completed processing but have no response to give."

    session.add_message("user", content)
    session.add_message("assistant", final_content)
    agent.sessions.save(session)
    updated_at = session.updated_at.isoformat()

    yield {
        "type": "chat.final",
        "run_id": run_id,
        "full_text": final_content,
        "usage": final_usage,
        "session_key": session_key,
    }
    yield {"type": "session.updated", "session_key": session_key, "updated_at": updated_at}
    agent.clear_stream_run(run_id)
