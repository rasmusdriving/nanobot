export type ViewKey = 'command' | 'sessions' | 'schedules' | 'heartbeat' | 'skills' | 'config' | 'diagnostics';

export interface SessionSummary {
  key: string;
  created_at?: string;
  updated_at?: string;
  path?: string;
}

export interface SessionMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export interface SessionDetail {
  key: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  messages: SessionMessage[];
  path: string;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: 'every' | 'cron' | 'at';
    everyMs?: number | null;
    expr?: string | null;
    atMs?: number | null;
  };
  payload: {
    message: string;
    channel?: string | null;
    to?: string | null;
    deliver: boolean;
  };
  state: {
    nextRunAtMs?: number | null;
    lastRunAtMs?: number | null;
    lastStatus?: string | null;
    lastError?: string | null;
  };
}

export interface SkillItem {
  name: string;
  path: string;
  source: string;
  enabled: boolean;
  always: boolean | null;
  description: string;
  available: boolean;
}

export interface WsServerEvent {
  type: string;
  run_id?: string;
  text_delta?: string;
  tool_name?: string;
  args?: unknown;
  result_preview?: string;
  ok?: boolean;
  full_text?: string;
  usage?: Record<string, number>;
  session_key?: string;
  updated_at?: string;
  message?: string;
}
