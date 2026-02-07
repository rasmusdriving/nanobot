import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../api';
import type { CronJob, SessionDetail, SessionSummary, SkillItem } from '../../types';

const TOKEN_STORAGE_KEY = 'pobot_web_token';

function generateSessionKey(): string {
  return `web:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useControlRoomData() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [tokenDraft, setTokenDraft] = useState(token);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionKey, setSelectedSessionKey] = useState('web:control-room');
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [channel, setChannel] = useState('cli');
  const [chatId, setChatId] = useState('web');
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [heartbeat, setHeartbeat] = useState({ content: '', intervalSeconds: 1800 });
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  const selectedSessionRef = useRef(selectedSessionKey);
  useEffect(() => {
    selectedSessionRef.current = selectedSessionKey;
  }, [selectedSessionKey]);

  const queueDepth = useMemo(() => {
    const queues = (status.queues as Record<string, number>) ?? {};
    return (queues.inbound ?? 0) + (queues.outbound ?? 0);
  }, [status]);

  const activeRuns = useMemo(() => Number(status.activeRuns ?? 0), [status]);

  const setError = useCallback((error: unknown) => {
    setNotice((error as Error).message ?? 'Unexpected error');
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiGet<Record<string, unknown>>('/status', token);
      setStatus(data);
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet<{ sessions: SessionSummary[] }>('/sessions', token);
      setSessions(data.sessions);
      if (!data.sessions.find((item) => item.key === selectedSessionRef.current) && data.sessions.length > 0) {
        setSelectedSessionKey(data.sessions[0].key);
      }
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const loadSessionDetail = useCallback(
    async (key: string, subscribe?: (sessionKey: string) => void) => {
      try {
        const data = await apiGet<SessionDetail>(`/sessions/${encodeURIComponent(key)}`, token);
        setSessionDetail(data);
        subscribe?.(key);
      } catch {
        setSessionDetail(null);
      }
    },
    [token],
  );

  const loadCronJobs = useCallback(async () => {
    try {
      const data = await apiGet<{ jobs: CronJob[] }>('/cron/jobs', token);
      setCronJobs(data.jobs);
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const loadHeartbeat = useCallback(async () => {
    try {
      const data = await apiGet<{ content: string; intervalSeconds: number }>('/heartbeat', token);
      setHeartbeat({ content: data.content, intervalSeconds: data.intervalSeconds });
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const loadSkills = useCallback(async () => {
    try {
      const data = await apiGet<{ skills: SkillItem[] }>('/skills', token);
      setSkills(data.skills);
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiGet<{ config: Record<string, unknown> }>('/config', token);
      setConfig(data.config);
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStatus(), loadSessions(), loadCronJobs(), loadHeartbeat(), loadSkills(), loadConfig()]);
  }, [loadConfig, loadCronJobs, loadHeartbeat, loadSessions, loadSkills, loadStatus]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const sessionExists = sessions.some((item) => item.key === selectedSessionKey);
    if (!sessionExists) {
      setSessionDetail(null);
    }
  }, [selectedSessionKey, sessions]);

  const applyToken = useCallback(() => {
    setToken(tokenDraft);
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenDraft);
  }, [tokenDraft]);

  const clearNotice = useCallback(() => {
    setNotice('');
  }, []);

  const pushNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const createThread = useCallback(() => {
    setSelectedSessionKey(generateSessionKey());
    setSessionDetail(null);
  }, []);

  const deleteSession = useCallback(
    async (key: string) => {
      try {
        await apiDelete(`/sessions/${encodeURIComponent(key)}`, token);
        if (selectedSessionRef.current === key) {
          setSelectedSessionKey(generateSessionKey());
          setSessionDetail(null);
        }
        await loadSessions();
      } catch (error) {
        setError(error);
      }
    },
    [loadSessions, setError, token],
  );

  const createCron = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        await apiPost('/cron/jobs', token, payload);
        await loadCronJobs();
      } catch (error) {
        setError(error);
      }
    },
    [loadCronJobs, setError, token],
  );

  const patchCron = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      try {
        await apiPatch(`/cron/jobs/${id}`, token, payload);
        await loadCronJobs();
      } catch (error) {
        setError(error);
      }
    },
    [loadCronJobs, setError, token],
  );

  const runCron = useCallback(
    async (id: string) => {
      try {
        await apiPost(`/cron/jobs/${id}/run`, token, {});
        await loadCronJobs();
      } catch (error) {
        setError(error);
      }
    },
    [loadCronJobs, setError, token],
  );

  const removeCron = useCallback(
    async (id: string) => {
      try {
        await apiDelete(`/cron/jobs/${id}`, token);
        await loadCronJobs();
      } catch (error) {
        setError(error);
      }
    },
    [loadCronJobs, setError, token],
  );

  const saveHeartbeat = useCallback(
    async (content: string) => {
      try {
        await apiPut('/heartbeat/file', token, { content });
        await loadHeartbeat();
      } catch (error) {
        setError(error);
      }
    },
    [loadHeartbeat, setError, token],
  );

  const triggerHeartbeat = useCallback(async () => {
    try {
      const response = await apiPost<{ response?: string }>('/heartbeat/trigger', token, {});
      setNotice(`Heartbeat response: ${response.response ?? '(empty)'}`);
    } catch (error) {
      setError(error);
    }
  }, [setError, token]);

  const saveSkills = useCallback(
    async (settings: Record<string, { enabled: boolean; always: boolean | null }>) => {
      try {
        await apiPut('/skills/settings', token, { skills: settings });
        await loadSkills();
      } catch (error) {
        setError(error);
      }
    },
    [loadSkills, setError, token],
  );

  const saveConfig = useCallback(
    async (nextConfig: Record<string, unknown>) => {
      try {
        const response = await apiPut<{ config: Record<string, unknown> }>('/config', token, { config: nextConfig });
        setConfig(response.config);
        setNotice('Config saved. Restart required for provider/channel changes.');
      } catch (error) {
        setError(error);
      }
    },
    [setError, token],
  );

  return {
    token,
    tokenDraft,
    notice,
    status,
    sessions,
    selectedSessionKey,
    sessionDetail,
    channel,
    chatId,
    cronJobs,
    heartbeat,
    skills,
    config,
    queueDepth,
    activeRuns,
    setTokenDraft,
    applyToken,
    clearNotice,
    pushNotice,
    refreshAll,
    refreshSessions: loadSessions,
    setSelectedSessionKey,
    loadSessionDetail,
    createThread,
    deleteSession,
    setChannel,
    setChatId,
    createCron,
    patchCron,
    runCron,
    removeCron,
    saveHeartbeat,
    triggerHeartbeat,
    saveSkills,
    saveConfig,
  };
}
