import type { RunStreamState, StreamRunMessage, ToolActivityStep, WsServerEvent } from '../../types';

const MAX_RUNS = 80;
const DEFAULT_SESSION_KEY = 'web:control-room';

export const initialRunStreamState: RunStreamState = {
  order: [],
  runs: {},
  activeRunBySession: {},
};

type RunAction =
  | { type: 'ws.event'; event: WsServerEvent }
  | { type: 'session.synced'; sessionKey: string }
  | { type: 'clear.run'; runId: string };

export function runEventReducer(state: RunStreamState, action: RunAction): RunStreamState {
  if (action.type === 'ws.event') {
    return reduceWsEvent(state, action.event);
  }
  if (action.type === 'session.synced') {
    return clearSettledRunsForSession(state, action.sessionKey);
  }
  return clearSingleRun(state, action.runId);
}

function reduceWsEvent(state: RunStreamState, event: WsServerEvent): RunStreamState {
  if (event.type === 'chat.ack') {
    if (!event.run_id || !event.session_key) {
      return state;
    }
    return upsertRun(state, {
      runId: event.run_id,
      sessionKey: event.session_key,
      status: 'streaming',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tools: [],
    });
  }
  if (event.type === 'chat.delta' && event.run_id) {
    return appendDelta(state, event.run_id, event.text_delta ?? '');
  }
  if (event.type === 'tool.start' && event.run_id) {
    return pushToolStep(state, event.run_id, {
      id: `${event.run_id}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      name: event.tool_name ?? 'tool',
      args: event.args,
      status: 'running',
    });
  }
  if (event.type === 'tool.end' && event.run_id) {
    return completeToolStep(state, event.run_id, event.tool_name ?? 'tool', event.result_preview, event.ok);
  }
  if (event.type === 'chat.final' && event.run_id) {
    return finalizeRun(state, event.run_id, event.full_text ?? '', event.usage, event.session_key);
  }
  if (event.type === 'agent.error') {
    return failRun(state, event.run_id, event.message ?? 'Unexpected agent error');
  }
  return state;
}

function appendDelta(state: RunStreamState, runId: string, delta: string): RunStreamState {
  const run = ensureRun(state, runId);
  const next: StreamRunMessage = {
    ...run,
    status: 'streaming',
    content: `${run.content}${delta}`,
    updatedAt: Date.now(),
  };
  return commitRun(state, next, false);
}

function pushToolStep(state: RunStreamState, runId: string, step: ToolActivityStep): RunStreamState {
  const run = ensureRun(state, runId);
  const next: StreamRunMessage = {
    ...run,
    tools: [...run.tools, step],
    updatedAt: Date.now(),
  };
  return commitRun(state, next, false);
}

function completeToolStep(
  state: RunStreamState,
  runId: string,
  toolName: string,
  resultPreview?: string,
  ok?: boolean,
): RunStreamState {
  const run = ensureRun(state, runId);
  const tools = [...run.tools];
  const idx = findOpenToolStep(tools, toolName);
  if (idx >= 0) {
    tools[idx] = {
      ...tools[idx],
      status: 'done',
      resultPreview,
      ok,
    };
  } else {
    tools.push({
      id: `${runId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      name: toolName,
      status: 'done',
      resultPreview,
      ok,
    });
  }
  const next: StreamRunMessage = { ...run, tools, updatedAt: Date.now() };
  return commitRun(state, next, false);
}

function findOpenToolStep(steps: ToolActivityStep[], toolName: string): number {
  for (let idx = steps.length - 1; idx >= 0; idx -= 1) {
    if (steps[idx].name === toolName && steps[idx].status === 'running') {
      return idx;
    }
  }
  return -1;
}

function finalizeRun(
  state: RunStreamState,
  runId: string,
  fullText: string,
  usage?: Record<string, number>,
  sessionKey?: string,
): RunStreamState {
  const run = ensureRun(state, runId, sessionKey);
  const next: StreamRunMessage = {
    ...run,
    sessionKey: sessionKey ?? run.sessionKey,
    status: 'final',
    content: fullText || run.content,
    usage,
    updatedAt: Date.now(),
  };
  return commitRun(state, next, true);
}

function failRun(state: RunStreamState, runId: string | undefined, message: string): RunStreamState {
  if (!runId) {
    return state;
  }
  const run = ensureRun(state, runId);
  const next: StreamRunMessage = {
    ...run,
    status: 'error',
    error: message,
    updatedAt: Date.now(),
  };
  return commitRun(state, next, true);
}

function clearSettledRunsForSession(state: RunStreamState, sessionKey: string): RunStreamState {
  const nextRuns: Record<string, StreamRunMessage> = {};
  const nextOrder: string[] = [];
  for (const runId of state.order) {
    const run = state.runs[runId];
    if (!run) {
      continue;
    }
    const remove = run.sessionKey === sessionKey && run.status !== 'streaming';
    if (!remove) {
      nextRuns[runId] = run;
      nextOrder.push(runId);
    }
  }
  const active = { ...state.activeRunBySession };
  if (active[sessionKey] && !nextRuns[active[sessionKey] ?? '']) {
    active[sessionKey] = null;
  }
  return {
    ...state,
    order: nextOrder,
    runs: nextRuns,
    activeRunBySession: active,
  };
}

function clearSingleRun(state: RunStreamState, runId: string): RunStreamState {
  if (!state.runs[runId]) {
    return state;
  }
  const run = state.runs[runId];
  const nextRuns = { ...state.runs };
  delete nextRuns[runId];
  const active = { ...state.activeRunBySession };
  if (active[run.sessionKey] === runId) {
    active[run.sessionKey] = null;
  }
  return {
    ...state,
    order: state.order.filter((id) => id !== runId),
    runs: nextRuns,
    activeRunBySession: active,
  };
}

function upsertRun(state: RunStreamState, run: StreamRunMessage): RunStreamState {
  return commitRun(state, run, false);
}

function ensureRun(state: RunStreamState, runId: string, sessionKey?: string): StreamRunMessage {
  const existing = state.runs[runId];
  if (existing) {
    return existing;
  }
  return {
    runId,
    sessionKey: sessionKey ?? DEFAULT_SESSION_KEY,
    status: 'streaming',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [],
  };
}

function commitRun(state: RunStreamState, run: StreamRunMessage, clearActive: boolean): RunStreamState {
  const hasRun = Boolean(state.runs[run.runId]);
  const order = hasRun ? state.order : [...state.order, run.runId];
  const trimmedOrder = trimOrder(order);
  const trimmedRuns = projectRuns(state.runs, trimmedOrder, run);
  const active = { ...state.activeRunBySession };
  if (clearActive) {
    if (active[run.sessionKey] === run.runId) {
      active[run.sessionKey] = null;
    }
  } else {
    active[run.sessionKey] = run.runId;
  }
  return { order: trimmedOrder, runs: trimmedRuns, activeRunBySession: active };
}

function trimOrder(order: string[]): string[] {
  if (order.length <= MAX_RUNS) {
    return order;
  }
  return order.slice(order.length - MAX_RUNS);
}

function projectRuns(
  runs: Record<string, StreamRunMessage>,
  order: string[],
  nextRun: StreamRunMessage,
): Record<string, StreamRunMessage> {
  const projected: Record<string, StreamRunMessage> = {};
  for (const runId of order) {
    if (runId === nextRun.runId) {
      projected[runId] = nextRun;
      continue;
    }
    const existing = runs[runId];
    if (existing) {
      projected[runId] = existing;
    }
  }
  if (!projected[nextRun.runId]) {
    projected[nextRun.runId] = nextRun;
  }
  return projected;
}

export type { RunAction };
