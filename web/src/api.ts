const API_PREFIX = '/api/v1';

function authHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('text/html');
}

function invalidJsonError(method: string, path: string, response: Response): Error {
  if (isHtmlResponse(response)) {
    return new Error('API returned HTML instead of JSON. Start the backend and verify the /api/v1 proxy.');
  }
  return new Error(`${method} ${path} returned invalid JSON`);
}

async function parseJsonBody<T>(response: Response, method: string, path: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw invalidJsonError(method, path, response);
  }
}

async function ensureJsonResponse<T>(response: Response, method: string, path: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status}`);
  }
  return parseJsonBody<T>(response, method, path);
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, { headers: authHeaders(token) });
  return ensureJsonResponse<T>(response, 'GET', path);
}

export async function apiDelete<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return ensureJsonResponse<T>(response, 'DELETE', path);
}

export async function apiPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return ensureJsonResponse<T>(response, 'POST', path);
}

export async function apiPut<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return ensureJsonResponse<T>(response, 'PUT', path);
}

export async function apiPatch<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return ensureJsonResponse<T>(response, 'PATCH', path);
}

export function createWs(token: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
  return new WebSocket(`${protocol}//${host}${API_PREFIX}/stream${suffix}`);
}
