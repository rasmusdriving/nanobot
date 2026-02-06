"""Authentication helpers for web API endpoints."""

from fastapi import Header, HTTPException, WebSocket, status


def parse_bearer_token(authorization: str | None) -> str:
    """Parse a bearer token from an Authorization header."""
    if not authorization:
        return ""
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return ""
    return parts[1].strip()


def verify_token(required_token: str, provided_token: str) -> None:
    """Raise unauthorized error when token is invalid."""
    if not required_token:
        return
    if provided_token != required_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )


def http_auth_dependency(required_token: str):
    """FastAPI dependency that validates bearer auth."""

    async def _dependency(authorization: str | None = Header(default=None)) -> None:
        verify_token(required_token, parse_bearer_token(authorization))

    return _dependency


async def ws_authenticate(websocket: WebSocket, required_token: str) -> bool:
    """Validate WS auth token from query or header."""
    if not required_token:
        return True
    query_token = websocket.query_params.get("token", "").strip()
    header_token = parse_bearer_token(websocket.headers.get("Authorization"))
    if query_token == required_token or header_token == required_token:
        return True
    await websocket.close(code=4401)
    return False
