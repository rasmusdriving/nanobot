import os

from nanobot.config.schema import Config
from nanobot.providers.litellm_provider import LiteLLMProvider


def test_config_selects_minimax_key_for_minimax_model() -> None:
    config = Config()
    config.providers.openrouter.api_key = "sk-or-123"
    config.providers.minimax.api_key = "mm-123"

    api_key = config.get_api_key("minimax/codex-MiniMax-M2.1")
    assert api_key == "mm-123"


def test_config_returns_default_minimax_base_when_key_set() -> None:
    config = Config()
    config.providers.minimax.api_key = "mm-123"

    api_base = config.get_api_base("minimax/codex-MiniMax-M2.1")
    assert api_base == "https://api.minimax.io/v1"


def test_config_returns_custom_minimax_base_when_set() -> None:
    config = Config()
    config.providers.minimax.api_key = "mm-123"
    config.providers.minimax.api_base = "https://custom.minimax.example/v1"

    api_base = config.get_api_base("minimax/MiniMax-M2.1")
    assert api_base == "https://custom.minimax.example/v1"


def test_config_does_not_force_minimax_base_without_minimax_key() -> None:
    config = Config()
    config.providers.openrouter.api_key = "sk-or-123"

    api_base = config.get_api_base("minimax/codex-MiniMax-M2.1")
    assert api_base is None


def test_litellm_provider_minimax_with_api_base_is_not_vllm(monkeypatch) -> None:
    monkeypatch.delenv("MINIMAX_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    provider = LiteLLMProvider(
        api_key="mm-123",
        api_base="https://api.minimax.io/v1",
        default_model="minimax/codex-MiniMax-M2.1",
    )

    assert provider.model_provider == "minimax"
    assert provider.is_vllm is False
    assert os.environ["MINIMAX_API_KEY"] == "mm-123"
    assert provider._normalize_model_name("codex-MiniMax-M2.1") == "minimax/codex-MiniMax-M2.1"


async def test_chat_normalizes_codex_minimax_model(monkeypatch) -> None:
    captured: dict[str, str] = {}

    class _DummyMessage:
        content = "minimax-ok"
        tool_calls = None

    class _DummyChoice:
        message = _DummyMessage()
        finish_reason = "stop"

    class _DummyUsage:
        prompt_tokens = 1
        completion_tokens = 1
        total_tokens = 2

    class _DummyResponse:
        choices = [_DummyChoice()]
        usage = _DummyUsage()

    async def _fake_acompletion(**kwargs):
        captured["model"] = kwargs["model"]
        return _DummyResponse()

    monkeypatch.setattr("nanobot.providers.litellm_provider.acompletion", _fake_acompletion)

    provider = LiteLLMProvider(
        api_key="mm-123",
        api_base="https://api.minimax.io/v1",
        default_model="codex-MiniMax-M2.1",
    )
    response = await provider.chat(messages=[{"role": "user", "content": "hello"}])

    assert captured["model"] == "minimax/codex-MiniMax-M2.1"
    assert response.content == "minimax-ok"
