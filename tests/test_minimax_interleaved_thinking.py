from pathlib import Path
from typing import Any

from nanobot.agent.context import ContextBuilder
from nanobot.agent.loop import AgentLoop
from nanobot.agent.subagent import SubagentManager
from nanobot.bus.queue import MessageBus
from nanobot.providers.base import LLMResponse, ToolCallRequest
from nanobot.providers.litellm_provider import LiteLLMProvider


class _DummyMessage:
    def __init__(
        self,
        content: str,
        tool_calls: list[Any] | None = None,
        provider_specific_fields: dict[str, Any] | None = None,
    ):
        self.content = content
        self.role = "assistant"
        self.tool_calls = tool_calls
        self.function_call = None
        self.provider_specific_fields = provider_specific_fields

    def model_dump(self, exclude_none: bool = False) -> dict[str, Any]:
        return {
            "content": self.content,
            "role": self.role,
            "tool_calls": self.tool_calls,
            "function_call": self.function_call,
            "provider_specific_fields": self.provider_specific_fields,
        }


class _DummyChoice:
    def __init__(self, message: _DummyMessage, finish_reason: str = "stop"):
        self.message = message
        self.finish_reason = finish_reason


class _DummyUsage:
    prompt_tokens = 1
    completion_tokens = 1
    total_tokens = 2


class _DummyResponse:
    def __init__(self, message: _DummyMessage, finish_reason: str = "stop"):
        self.choices = [_DummyChoice(message, finish_reason=finish_reason)]
        self.usage = _DummyUsage()


async def test_minimax_chat_enables_reasoning_split(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    async def _fake_acompletion(**kwargs: Any):
        captured.update(kwargs)
        msg = _DummyMessage(
            content="ok",
            provider_specific_fields={"reasoning_details": [{"text": "plan"}]},
        )
        return _DummyResponse(msg)

    monkeypatch.setattr("nanobot.providers.litellm_provider.acompletion", _fake_acompletion)

    provider = LiteLLMProvider(
        api_key="mm-123",
        api_base="https://api.minimax.io/v1",
        default_model="minimax/codex-MiniMax-M2.1",
    )
    response = await provider.chat(messages=[{"role": "user", "content": "hello"}])

    assert captured["reasoning_split"] is True
    assert response.assistant_message is not None
    assert response.assistant_message["provider_specific_fields"]["reasoning_details"][0]["text"] == "plan"


async def test_non_minimax_chat_does_not_force_reasoning_split(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    async def _fake_acompletion(**kwargs: Any):
        captured.update(kwargs)
        return _DummyResponse(_DummyMessage(content="ok"))

    monkeypatch.setattr("nanobot.providers.litellm_provider.acompletion", _fake_acompletion)

    provider = LiteLLMProvider(
        api_key="ak-123",
        default_model="anthropic/claude-opus-4-5",
    )
    await provider.chat(messages=[{"role": "user", "content": "hello"}])

    assert "reasoning_split" not in captured


def test_context_add_assistant_message_keeps_provider_fields(tmp_path: Path) -> None:
    context = ContextBuilder(tmp_path)
    messages: list[dict[str, Any]] = []

    context.add_assistant_message(
        messages=messages,
        content=None,
        tool_calls=[{"id": "call_1"}],
        assistant_message={
            "role": "assistant",
            "content": "",
            "provider_specific_fields": {"reasoning_details": [{"text": "x"}]},
        },
    )

    assert messages[-1]["provider_specific_fields"]["reasoning_details"][0]["text"] == "x"
    assert messages[-1]["tool_calls"][0]["id"] == "call_1"


async def test_agent_loop_preserves_assistant_payload_in_tool_turn(tmp_path: Path) -> None:
    class _DummySession:
        def get_history(self) -> list[dict[str, Any]]:
            return []

        def add_message(self, role: str, content: str) -> None:
            pass

    class _DummySessions:
        def __init__(self):
            self._session = _DummySession()

        def get_or_create(self, key: str) -> _DummySession:
            return self._session

        def save(self, session: _DummySession) -> None:
            pass

    class _RecordingProvider:
        def __init__(self):
            self.calls: list[list[dict[str, Any]]] = []
            self.turn = 0

        async def chat(
            self,
            messages: list[dict[str, Any]],
            tools: list[dict[str, Any]] | None = None,
            model: str | None = None,
            max_tokens: int = 4096,
            temperature: float = 0.7,
        ) -> LLMResponse:
            self.calls.append(messages)
            self.turn += 1
            if self.turn == 1:
                return LLMResponse(
                    content="",
                    tool_calls=[ToolCallRequest(id="call_1", name="fake_tool", arguments={"x": "1"})],
                    assistant_message={
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "type": "function",
                                "function": {"name": "fake_tool", "arguments": "{\"x\": \"1\"}"},
                            }
                        ],
                        "provider_specific_fields": {"reasoning_details": [{"text": "interleaved"}]},
                    },
                )
            return LLMResponse(content="done")

        def get_default_model(self) -> str:
            return "minimax/codex-MiniMax-M2.1"

    provider = _RecordingProvider()
    loop = AgentLoop(
        bus=MessageBus(),
        provider=provider,  # type: ignore[arg-type]
        workspace=tmp_path,
        model="minimax/codex-MiniMax-M2.1",
        max_iterations=2,
    )
    loop.sessions = _DummySessions()  # type: ignore[assignment]

    output = await loop.process_direct("hello")
    assert output == "done"
    assert len(provider.calls) == 2

    assistant_messages = [m for m in provider.calls[1] if m.get("role") == "assistant"]
    assert assistant_messages
    assert assistant_messages[-1]["provider_specific_fields"]["reasoning_details"][0]["text"] == "interleaved"


def test_subagent_message_builder_preserves_provider_fields() -> None:
    tool_calls = [{"id": "call_1", "type": "function"}]
    built = SubagentManager._build_assistant_tool_message(
        content="",
        tool_calls=tool_calls,
        assistant_message={
            "role": "assistant",
            "content": "",
            "provider_specific_fields": {"reasoning_details": [{"text": "subagent"}]},
        },
    )

    assert built["provider_specific_fields"]["reasoning_details"][0]["text"] == "subagent"
    assert built["tool_calls"] == tool_calls
