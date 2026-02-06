"""LiteLLM provider implementation for multi-provider support."""

import os
from typing import Any

import litellm
from litellm import acompletion

from nanobot.providers.base import LLMProvider, LLMResponse, ToolCallRequest


class LiteLLMProvider(LLMProvider):
    """
    LLM provider using LiteLLM for multi-provider support.
    
    Supports OpenRouter, Anthropic, OpenAI, Gemini, and many other providers through
    a unified interface.
    """
    
    MINIMAX_DEFAULT_API_BASE = "https://api.minimax.io/v1"

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        default_model: str = "anthropic/claude-opus-4-5",
    ):
        super().__init__(api_key, api_base)
        self.default_model = default_model
        self.model_provider = self._detect_model_provider(default_model)
        self.is_openrouter = self._is_openrouter_mode(api_key, api_base)
        self.is_vllm = self._is_vllm_mode(api_base)

        self._configure_environment(api_key, api_base)

        if api_base:
            litellm.api_base = api_base

        # Disable LiteLLM logging noise
        litellm.suppress_debug_info = True

    @staticmethod
    def _detect_model_provider(model: str) -> str:
        """Infer provider from model naming conventions."""
        model_lower = model.lower()
        if "openrouter" in model_lower:
            return "openrouter"
        if "deepseek" in model_lower:
            return "deepseek"
        if "anthropic" in model_lower or "claude" in model_lower:
            return "anthropic"
        if "openai" in model_lower or "gpt" in model_lower:
            return "openai"
        if "gemini" in model_lower:
            return "gemini"
        if any(k in model_lower for k in ("zhipu", "glm", "zai")):
            return "zhipu"
        if "groq" in model_lower:
            return "groq"
        if "moonshot" in model_lower or "kimi" in model_lower:
            return "moonshot"
        if "minimax" in model_lower or "codex-minimax" in model_lower:
            return "minimax"
        if "bedrock" in model_lower:
            return "bedrock"
        if model_lower.startswith("hosted_vllm/"):
            return "vllm"
        return "unknown"

    def _is_openrouter_mode(self, api_key: str | None, api_base: str | None) -> bool:
        """Detect OpenRouter mode by model, key format, or endpoint."""
        return bool(
            self.model_provider == "openrouter"
            or (api_key and api_key.startswith("sk-or-"))
            or (api_base and "openrouter" in api_base.lower())
        )

    def _is_vllm_mode(self, api_base: str | None) -> bool:
        """Treat custom API base as vLLM only for vLLM/unknown model providers."""
        if not api_base or self.is_openrouter:
            return False
        return self.model_provider in {"vllm", "unknown"}

    def _configure_environment(self, api_key: str | None, api_base: str | None) -> None:
        """Set provider-specific env vars expected by LiteLLM."""
        if not api_key:
            return

        if self.is_openrouter:
            os.environ["OPENROUTER_API_KEY"] = api_key
            return

        if self.is_vllm:
            os.environ["OPENAI_API_KEY"] = api_key
            return

        env_map = {
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "zhipu": "ZHIPUAI_API_KEY",
            "groq": "GROQ_API_KEY",
            "moonshot": "MOONSHOT_API_KEY",
            "minimax": "MINIMAX_API_KEY",
        }
        env_name = env_map.get(self.model_provider)
        if env_name:
            os.environ.setdefault(env_name, api_key)

        if self.model_provider == "moonshot":
            os.environ.setdefault("MOONSHOT_API_BASE", api_base or "https://api.moonshot.cn/v1")
        if self.model_provider == "minimax":
            os.environ.setdefault("MINIMAX_API_BASE", api_base or self.MINIMAX_DEFAULT_API_BASE)

    def _normalize_model_name(self, model: str) -> str:
        """Normalize model name to provider prefixes expected by LiteLLM."""
        normalized = model
        normalized_lower = normalized.lower()

        if self.is_openrouter and not normalized.startswith("openrouter/"):
            normalized = f"openrouter/{normalized}"
            normalized_lower = normalized.lower()

        if ("glm" in normalized_lower or "zhipu" in normalized_lower) and not (
            normalized.startswith("zhipu/")
            or normalized.startswith("zai/")
            or normalized.startswith("openrouter/")
        ):
            normalized = f"zai/{normalized}"
            normalized_lower = normalized.lower()

        if ("moonshot" in normalized_lower or "kimi" in normalized_lower) and not (
            normalized.startswith("moonshot/") or normalized.startswith("openrouter/")
        ):
            normalized = f"moonshot/{normalized}"
            normalized_lower = normalized.lower()

        if ("minimax" in normalized_lower or "codex-minimax" in normalized_lower) and not (
            normalized.startswith("minimax/") or normalized.startswith("openrouter/")
        ):
            normalized = f"minimax/{normalized}"
            normalized_lower = normalized.lower()

        if "gemini" in normalized_lower and not normalized.startswith("gemini/"):
            normalized = f"gemini/{normalized}"

        if self.is_vllm and not normalized.startswith("hosted_vllm/"):
            normalized = f"hosted_vllm/{normalized}"

        return normalized

    @staticmethod
    def _is_minimax_model(model: str) -> bool:
        """Check if a model should be treated as MiniMax."""
        model_lower = model.lower()
        return "minimax" in model_lower or "codex-minimax" in model_lower
    
    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """
        Send a chat completion request via LiteLLM.
        
        Args:
            messages: List of message dicts with 'role' and 'content'.
            tools: Optional list of tool definitions in OpenAI format.
            model: Model identifier (e.g., 'anthropic/claude-sonnet-4-5').
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature.
        
        Returns:
            LLMResponse with content and/or tool calls.
        """
        model = self._normalize_model_name(model or self.default_model)
        
        # kimi-k2.5 only supports temperature=1.0
        if "kimi-k2.5" in model.lower():
            temperature = 1.0

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        # MiniMax M2.1 supports interleaved thinking when reasoning is split.
        if self._is_minimax_model(model):
            kwargs["reasoning_split"] = True
        
        # Pass api_base directly for custom endpoints (vLLM, etc.)
        if self.api_base:
            kwargs["api_base"] = self.api_base
        
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        
        try:
            response = await acompletion(**kwargs)
            return self._parse_response(response)
        except Exception as e:
            # Return error as content for graceful handling
            return LLMResponse(
                content=f"Error calling LLM: {str(e)}",
                finish_reason="error",
            )
    
    def _parse_response(self, response: Any) -> LLMResponse:
        """Parse LiteLLM response into our standard format."""
        choice = response.choices[0]
        message = choice.message
        assistant_message = self._extract_assistant_message(message)
        
        tool_calls = []
        if hasattr(message, "tool_calls") and message.tool_calls:
            for tc in message.tool_calls:
                # Parse arguments from JSON string if needed
                args = tc.function.arguments
                if isinstance(args, str):
                    import json
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {"raw": args}
                
                tool_calls.append(ToolCallRequest(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))
        
        usage = {}
        if hasattr(response, "usage") and response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
        
        return LLMResponse(
            content=message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or "stop",
            usage=usage,
            assistant_message=assistant_message,
        )

    def _extract_assistant_message(self, message: Any) -> dict[str, Any] | None:
        """Extract provider-native assistant message payload."""
        if hasattr(message, "model_dump"):
            return message.model_dump(exclude_none=False)
        if isinstance(message, dict):
            return dict(message)
        extracted: dict[str, Any] = {}
        for key in ("role", "content", "tool_calls", "function_call", "provider_specific_fields"):
            if hasattr(message, key):
                extracted[key] = getattr(message, key)
        return extracted or None
    
    def get_default_model(self) -> str:
        """Get the default model."""
        return self.default_model
