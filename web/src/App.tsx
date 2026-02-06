import { useEffect, useMemo, useRef, useState } from 'react';

import { apiDelete, apiGet, apiPatch, apiPost, apiPut, createWs } from './api';
import { CommandDeck } from './components/CommandDeck';
import { ConfigPanel } from './components/ConfigPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { HeartbeatPanel } from './components/HeartbeatPanel';
import { SchedulesPanel } from './components/SchedulesPanel';
import { SessionsPanel } from './components/SessionsPanel';
import { Shell } from './components/Shell';
import { SkillsPanel } from './components/SkillsPanel';
import type { CronJob, SessionDetail, SessionSummary, SkillItem, ViewKey, WsServerEvent } from './types';

function App() {
  const [view, setView] = useState<ViewKey>('command');
  const [token, setToken] = useState(localStorage.getItem('pobot_web_token') ?? '');
  const [tokenInput, setTokenInput] = useState(token);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [heartbeat, setHeartbeat] = useState({ content: '', intervalSeconds: 1800 });
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [events, setEvents] = useState<WsServerEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const queueDepth = useMemo(() => {
    const queues = (status.queues as Record<string, number>) ?? {};
    return (queues.inbound ?? 0) + (queues.outbound ?? 0);
  }, [status]);

  useEffect(() => {
    localStorage.setItem('pobot_web_token', token);
    const socket = createWs(token);
    wsRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as WsServerEvent;
        setEvents((prev) => [...prev.slice(-299), event]);
        if (event.type === 'session.updated') {
          void loadSessions();
        }
      } catch (_error) {
        setNotice('WS message parse error');
      }
    };
    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    void refreshAll();
  }, [token]);

  async function refreshAll() {
    await Promise.all([loadStatus(), loadSessions(), loadCronJobs(), loadHeartbeat(), loadSkills(), loadConfig()]);
  }

  async function loadStatus() {
    try {
      const data = await apiGet<{ [key: string]: unknown }>('/status', token);
      setStatus(data);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function loadSessions() {
    try {
      const data = await apiGet<{ sessions: SessionSummary[] }>('/sessions', token);
      setSessions(data.sessions);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function openSession(key: string) {
    try {
      const data = await apiGet<SessionDetail>(`/sessions/${encodeURIComponent(key)}`, token);
      setSessionDetail(data);
      wsRef.current?.send(JSON.stringify({ type: 'session.subscribe', session_key: key }));
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function deleteSession(key: string) {
    try {
      await apiDelete(`/sessions/${encodeURIComponent(key)}`, token);
      setSessionDetail((current) => (current?.key === key ? null : current));
      await loadSessions();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function loadCronJobs() {
    try {
      const data = await apiGet<{ jobs: CronJob[] }>('/cron/jobs', token);
      setCronJobs(data.jobs);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function loadHeartbeat() {
    try {
      const data = await apiGet<{ content: string; intervalSeconds: number }>('/heartbeat', token);
      setHeartbeat({ content: data.content, intervalSeconds: data.intervalSeconds });
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function loadSkills() {
    try {
      const data = await apiGet<{ skills: SkillItem[] }>('/skills', token);
      setSkills(data.skills);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function loadConfig() {
    try {
      const data = await apiGet<{ config: Record<string, unknown> }>('/config', token);
      setConfig(data.config);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  function sendChat(payload: { content: string; session_key: string; channel: string; chat_id: string }) {
    wsRef.current?.send(JSON.stringify({ type: 'chat.send', ...payload }));
  }

  function cancelRun(runId: string) {
    wsRef.current?.send(JSON.stringify({ type: 'chat.cancel', run_id: runId }));
  }

  async function createCron(payload: Record<string, unknown>) {
    try {
      await apiPost('/cron/jobs', token, payload);
      await loadCronJobs();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function patchCron(id: string, payload: Record<string, unknown>) {
    try {
      await apiPatch(`/cron/jobs/${id}`, token, payload);
      await loadCronJobs();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function runCron(id: string) {
    try {
      await apiPost(`/cron/jobs/${id}/run`, token, {});
      await loadCronJobs();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function removeCron(id: string) {
    try {
      await apiDelete(`/cron/jobs/${id}`, token);
      await loadCronJobs();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function saveHeartbeat(content: string) {
    try {
      await apiPut('/heartbeat/file', token, { content });
      await loadHeartbeat();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function triggerHeartbeat() {
    try {
      const response = await apiPost<{ response?: string }>('/heartbeat/trigger', token, {});
      setNotice(`Heartbeat response: ${response.response ?? '(empty)'}`);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function saveSkills(settings: Record<string, { enabled: boolean; always: boolean | null }>) {
    try {
      await apiPut('/skills/settings', token, { skills: settings });
      await loadSkills();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function saveConfig(nextConfig: Record<string, unknown>) {
    try {
      const data = await apiPut<{ config: Record<string, unknown> }>('/config', token, { config: nextConfig });
      setConfig(data.config);
      setNotice('Config saved. Restart required for provider/channel changes.');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  const activeRuns = Number(status.activeRuns ?? 0);

  return (
    <>
      <Shell
        view={view}
        onChangeView={setView}
        activeRuns={activeRuns}
        queueDepth={queueDepth}
        cronJobs={cronJobs.length}
      >
        <section className="token-bar">
          <label>
            API Token
            <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Optional bearer token" />
          </label>
          <button className="btn" onClick={() => setToken(tokenInput)}>
            Apply Token
          </button>
          <button className="btn" onClick={() => void refreshAll()}>
            Reload All
          </button>
          {notice ? <p className="notice">{notice}</p> : null}
        </section>

        {view === 'command' ? <CommandDeck connected={connected} events={events} onSend={sendChat} onCancel={cancelRun} /> : null}
        {view === 'sessions' ? (
          <SessionsPanel sessions={sessions} detail={sessionDetail} onRefresh={() => void loadSessions()} onOpen={openSession} onDelete={deleteSession} />
        ) : null}
        {view === 'schedules' ? (
          <SchedulesPanel jobs={cronJobs} onRefresh={() => void loadCronJobs()} onCreate={createCron} onPatch={patchCron} onRun={runCron} onDelete={removeCron} />
        ) : null}
        {view === 'heartbeat' ? (
          <HeartbeatPanel content={heartbeat.content} intervalSeconds={heartbeat.intervalSeconds} onSave={saveHeartbeat} onTrigger={triggerHeartbeat} />
        ) : null}
        {view === 'skills' ? <SkillsPanel skills={skills} onSave={saveSkills} /> : null}
        {view === 'config' ? <ConfigPanel maskedConfig={config} onSave={saveConfig} /> : null}
        {view === 'diagnostics' ? <DiagnosticsPanel status={status} onRefresh={() => void loadStatus()} /> : null}
      </Shell>
    </>
  );
}

export default App;
