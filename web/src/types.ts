export type ViewKey = 'command' | 'sessions' | 'schedules' | 'heartbeat' | 'skills' | 'config' | 'diagnostics';

export type ConnectionState = 'connecting' | 'reconnecting' | 'connected' | 'offline';

export type DrawerPanelKey = 'overview' | 'schedules' | 'heartbeat' | 'skills' | 'config' | 'diagnostics';

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

interface WsEventBase {
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

export interface ChatAckEvent extends WsEventBase {
  type: 'chat.ack';
  run_id: string;
  session_key: string;
}

export interface ChatDeltaEvent extends WsEventBase {
  type: 'chat.delta';
  run_id: string;
  text_delta: string;
}

export interface ToolStartEvent extends WsEventBase {
  type: 'tool.start';
  run_id: string;
  tool_name: string;
  args?: unknown;
}

export interface ToolEndEvent extends WsEventBase {
  type: 'tool.end';
  run_id: string;
  tool_name: string;
  result_preview?: string;
  ok?: boolean;
}

export interface ChatFinalEvent extends WsEventBase {
  type: 'chat.final';
  run_id: string;
  full_text: string;
  usage?: Record<string, number>;
  session_key?: string;
}

export interface AgentErrorEvent extends WsEventBase {
  type: 'agent.error';
  run_id?: string;
  message?: string;
}

export interface SessionUpdatedEvent extends WsEventBase {
  type: 'session.updated';
  session_key: string;
  updated_at?: string;
}

export interface GenericWsEvent extends WsEventBase {
  type: string;
}

export type WsServerEvent =
  | ChatAckEvent
  | ChatDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ChatFinalEvent
  | AgentErrorEvent
  | SessionUpdatedEvent
  | GenericWsEvent;

export interface ToolActivityStep {
  id: string;
  name: string;
  args?: unknown;
  resultPreview?: string;
  ok?: boolean;
  status: 'running' | 'done';
}

export interface StreamRunMessage {
  runId: string;
  sessionKey: string;
  status: 'streaming' | 'final' | 'error';
  content: string;
  usage?: Record<string, number>;
  error?: string;
  createdAt: number;
  updatedAt: number;
  tools: ToolActivityStep[];
}

export interface RunStreamState {
  order: string[];
  runs: Record<string, StreamRunMessage>;
  activeRunBySession: Record<string, string | null>;
}
