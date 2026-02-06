"""Utilities for safe config read/write operations."""

from typing import Any

from nanobot.config.loader import convert_keys, convert_to_camel
from nanobot.config.schema import Config

_SENSITIVE_KEYWORDS = ("api_key", "apikey", "token", "secret", "password")
_MASKED_VALUE = "********"


def _is_sensitive_key(key: str) -> bool:
    text = key.lower()
    return any(word in text for word in _SENSITIVE_KEYWORDS)


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return _MASKED_VALUE
    return f"{value[:2]}{_MASKED_VALUE}{value[-2:]}"


def mask_sensitive_fields(data: Any, key: str | None = None) -> Any:
    """Mask secret-looking values recursively."""
    if isinstance(data, dict):
        return {k: mask_sensitive_fields(v, k) for k, v in data.items()}
    if isinstance(data, list):
        return [mask_sensitive_fields(v, key) for v in data]
    if isinstance(data, str) and key and _is_sensitive_key(key):
        return _mask_secret(data)
    return data


def config_to_masked_payload(config: Config) -> dict[str, Any]:
    """Convert config object to client-safe payload."""
    camel = convert_to_camel(config.model_dump())
    return mask_sensitive_fields(camel)


def _should_keep_existing(key: str, value: Any) -> bool:
    """Detect masked placeholder values that should not overwrite secrets."""
    if not _is_sensitive_key(key) or not isinstance(value, str):
        return False
    stars = value.count("*")
    return stars >= 4 and value.replace("*", "").strip() != value.strip()


def _deep_merge(base: Any, patch: Any) -> Any:
    """Deep merge dictionaries recursively."""
    if not isinstance(base, dict) or not isinstance(patch, dict):
        return patch
    merged = dict(base)
    for key, value in patch.items():
        if key in merged and _should_keep_existing(key, value):
            continue
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def build_updated_config(config: Config, patch_payload: dict[str, Any]) -> Config:
    """Apply a camelCase config patch and validate the result."""
    current = convert_to_camel(config.model_dump())
    merged = _deep_merge(current, patch_payload)
    snake_case = convert_keys(merged)
    return Config.model_validate(snake_case)
