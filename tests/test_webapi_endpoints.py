from collections.abc import AsyncIterator
from pathlib import Path

from fastapi.testclient import TestClient

from nanobot.agent.loop import AgentLoop
from nanobot.bus.queue import MessageBus
from nanobot.config.schema import Config
from nanobot.cron.service import CronService
from nanobot.heartbeat.service import HeartbeatService
from nanobot.providers.base import LLMProvider, LLMResponse
from nanobot.webapi import WebAPIState, create_web_app


class DummyProvider(LLMProvider):
    def __init__(self):
        super().__init__(api_key='test', api_base=None)

    async def chat(self, messages, tools=None, model=None, max_tokens=4096, temperature=0.7):
        return LLMResponse(content='ok')

    async def chat_stream(
        self,
        messages,
        tools=None,
        model=None,
        max_tokens=4096,
        temperature=0.7,
    ) -> AsyncIterator[dict]:
        yield {'type': 'delta', 'text': 'ok'}
        yield {'type': 'done', 'response': LLMResponse(content='ok')}

    def get_default_model(self):
        return 'dummy'


def _build_client(tmp_path: Path) -> tuple[TestClient, WebAPIState]:
    workspace = tmp_path / 'workspace'
    workspace.mkdir()

    config = Config()
    config.agents.defaults.workspace = str(workspace)
    config.gateway.web_token = 'secret-token'

    bus = MessageBus()
    provider = DummyProvider()
    cron = CronService(tmp_path / 'cron' / 'jobs.json')

    async def on_heartbeat(prompt: str) -> str:
        return f'heartbeat:{prompt[:10]}'

    heartbeat = HeartbeatService(workspace=workspace, on_heartbeat=on_heartbeat, interval_s=60, enabled=True)
    agent = AgentLoop(
        bus=bus,
        provider=provider,
        workspace=workspace,
        model='dummy',
        max_iterations=2,
        cron_service=cron,
    )

    state = WebAPIState(
        config=config,
        bus=bus,
        agent=agent,
        cron=cron,
        heartbeat=heartbeat,
        channels=None,
        workspace=workspace,
        gateway_port=18790,
        config_path=tmp_path / 'config.json',
    )
    return TestClient(create_web_app(state)), state


def _headers() -> dict[str, str]:
    return {'Authorization': 'Bearer secret-token'}


def test_heartbeat_and_cron_endpoints(tmp_path: Path) -> None:
    client, _ = _build_client(tmp_path)

    get_hb = client.get('/api/v1/heartbeat', headers=_headers())
    assert get_hb.status_code == 200

    put_hb = client.put('/api/v1/heartbeat/file', headers=_headers(), json={'content': '# HEARTBEAT\n- [ ] check'})
    assert put_hb.status_code == 200

    post_job = client.post(
        '/api/v1/cron/jobs',
        headers=_headers(),
        json={
            'name': 'hourly-check',
            'message': 'check status',
            'schedule_kind': 'every',
            'every_seconds': 120,
        },
    )
    assert post_job.status_code == 200
    job_id = post_job.json()['job']['id']

    list_jobs = client.get('/api/v1/cron/jobs', headers=_headers())
    assert list_jobs.status_code == 200
    assert any(job['id'] == job_id for job in list_jobs.json()['jobs'])

    patch_job = client.patch(f'/api/v1/cron/jobs/{job_id}', headers=_headers(), json={'enabled': False})
    assert patch_job.status_code == 200
    assert patch_job.json()['job']['enabled'] is False

    run_job = client.post(f'/api/v1/cron/jobs/{job_id}/run', headers=_headers(), json={})
    assert run_job.status_code == 200

    delete_job = client.delete(f'/api/v1/cron/jobs/{job_id}', headers=_headers())
    assert delete_job.status_code == 200


def test_config_endpoint_masks_secrets(tmp_path: Path) -> None:
    client, state = _build_client(tmp_path)
    state.config.providers.openai.api_key = 'sk-test-secret-12345'

    response = client.get('/api/v1/config', headers=_headers())
    assert response.status_code == 200
    payload = response.json()['config']
    masked = payload['providers']['openai']['apiKey']
    assert masked != 'sk-test-secret-12345'
    assert '*' in masked

    update = client.put(
        '/api/v1/config',
        headers=_headers(),
        json={'config': {'providers': {'openai': {'apiKey': masked}}}},
    )
    assert update.status_code == 200
    assert state.config.providers.openai.api_key == 'sk-test-secret-12345'


def test_auth_is_enforced(tmp_path: Path) -> None:
    client, _ = _build_client(tmp_path)
    response = client.get('/api/v1/status')
    assert response.status_code == 401


def test_websocket_stream_order(tmp_path: Path) -> None:
    client, _ = _build_client(tmp_path)
    with client.websocket_connect('/api/v1/stream?token=secret-token') as ws:
        ws.send_json(
            {
                'type': 'chat.send',
                'session_key': 'web:test',
                'content': 'hello',
                'channel': 'cli',
                'chat_id': 'web',
            }
        )
        ack = ws.receive_json()
        delta = ws.receive_json()
        final = ws.receive_json()
        assert ack['type'] == 'chat.ack'
        assert delta['type'] == 'chat.delta'
        assert final['type'] == 'chat.final'
