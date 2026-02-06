"""Helpers for converting LiteLLM stream chunks into nanobot events."""

import json
from collections.abc import AsyncIterator
from typing import Any

from nanobot.providers.base import LLMResponse, ToolCallRequest


def _to_dict(value: Any) -> dict[str, Any]:
    """Convert provider objects to dictionaries."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    return {}


def _usage_from_chunk(chunk: Any) -> dict[str, int]:
    """Read token usage fields when present."""
    usage = getattr(chunk, "usage", None)
    if not usage:
        return {}
    return {
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
        "total_tokens": usage.total_tokens,
    }


def _accumulate_tool_calls(tool_map: dict[int, dict[str, Any]], entries: list[Any]) -> None:
    """Collect streamed tool-call fragments by index."""
    for entry in entries:
        item = _to_dict(entry)
        index = int(item.get("index", 0))
        state = tool_map.setdefault(index, {"id": "", "name": "", "args": []})
        state["id"] = item.get("id") or state["id"]
        fn = _to_dict(item.get("function"))
        state["name"] = fn.get("name") or state["name"]
        args = fn.get("arguments")
        if isinstance(args, str) and args:
            state["args"].append(args)


def _build_tool_calls(tool_map: dict[int, dict[str, Any]]) -> list[ToolCallRequest]:
    """Build tool calls from streamed fragments."""
    calls: list[ToolCallRequest] = []
    for idx in sorted(tool_map):
        state = tool_map[idx]
        raw_args = "".join(state["args"]).strip()
        try:
            parsed_args = json.loads(raw_args) if raw_args else {}
        except json.JSONDecodeError:
            parsed_args = {"raw": raw_args}
        calls.append(ToolCallRequest(
            id=state["id"] or f"tool_{idx}",
            name=state["name"] or "unknown",
            arguments=parsed_args if isinstance(parsed_args, dict) else {"value": parsed_args},
        ))
    return calls


async def consume_litellm_stream(stream: Any) -> AsyncIterator[dict[str, Any]]:
    """Convert LiteLLM chunks into delta/done events."""
    text_parts: list[str] = []
    usage: dict[str, int] = {}
    finish_reason = "stop"
    tool_map: dict[int, dict[str, Any]] = {}

    async for chunk in stream:
        choices = getattr(chunk, "choices", None) or []
        chunk_usage = _usage_from_chunk(chunk)
        if chunk_usage:
            usage = chunk_usage
        if not choices:
            continue
        choice = choices[0]
        if getattr(choice, "finish_reason", None):
            finish_reason = choice.finish_reason
        delta = _to_dict(getattr(choice, "delta", None))
        text = delta.get("content")
        if isinstance(text, str) and text:
            text_parts.append(text)
            yield {"type": "delta", "text": text}
        _accumulate_tool_calls(tool_map, delta.get("tool_calls") or [])

    full_text = "".join(text_parts)
    yield {"type": "done", "response": LLMResponse(
        content=full_text or None,
        tool_calls=_build_tool_calls(tool_map),
        finish_reason=finish_reason,
        usage=usage,
        assistant_message={"role": "assistant", "content": full_text},
    )}
