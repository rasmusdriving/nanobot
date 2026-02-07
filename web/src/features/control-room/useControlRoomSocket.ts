import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { createWs } from '../../api';
import type { ConnectionState, RunStreamState, WsServerEvent } from '../../types';
import { initialRunStreamState, runEventReducer } from './runEventReducer';

function parseWsEvent(raw: string): WsServerEvent | null {
  try {
    const event = JSON.parse(raw) as WsServerEvent;
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
      return null;
    }
    return event;
  } catch {
    return null;
  }
}

interface ControlRoomSocketProps {
  token: string;
  onSessionUpdated: (sessionKey: string) => void;
  onError: (message: string) => void;
}

interface ControlRoomSocketState {
  connection: ConnectionState;
  reconnectDelayMs: number;
  events: WsServerEvent[];
  runs: RunStreamState;
  sendChat: (content: string, sessionKey: string, channel: string, chatId: string) => void;
  cancelRun: (runId: string) => void;
  subscribeSession: (sessionKey: string) => void;
}

export function useControlRoomSocket(props: ControlRoomSocketProps): ControlRoomSocketState {
  const { token, onSessionUpdated, onError } = props;
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [reconnectDelayMs, setReconnectDelayMs] = useState(0);
  const [events, setEvents] = useState<WsServerEvent[]>([]);
  const [runs, dispatchRun] = useReducer(runEventReducer, initialRunStreamState);

  const wsRef = useRef<WebSocket | null>(null);

  const handleEvent = useCallback(
    (event: WsServerEvent) => {
      setEvents((prev) => [...prev.slice(-399), event]);
      dispatchRun({ type: 'ws.event', event });
      if (event.type === 'session.updated') {
        if (event.session_key) {
          onSessionUpdated(event.session_key);
        }
      }
      if (event.type === 'agent.error') {
        onError(event.message ?? 'Agent error');
      }
    },
    [onError, onSessionUpdated],
  );

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let attempt = 0;

    const connect = () => {
      if (disposed) {
        return;
      }
      setConnection(attempt === 0 ? 'connecting' : 'reconnecting');
      socket = createWs(token);
      wsRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setReconnectDelayMs(0);
        setConnection('connected');
      };
      socket.onmessage = (message) => {
        const event = parseWsEvent(message.data);
        if (!event) {
          onError('WS message parse error');
          return;
        }
        handleEvent(event);
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) {
          return;
        }
        setConnection('offline');
        attempt = Math.min(attempt + 1, 6);
        const delay = Math.min(8000, 400 * 2 ** (attempt - 1));
        setReconnectDelayMs(delay);
        timer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      socket?.close();
      wsRef.current = null;
    };
  }, [handleEvent, onError, token]);

  const sendChat = useCallback((content: string, sessionKey: string, channel: string, chatId: string) => {
    wsRef.current?.send(
      JSON.stringify({
        type: 'chat.send',
        content,
        session_key: sessionKey,
        channel,
        chat_id: chatId,
      }),
    );
  }, []);

  const cancelRun = useCallback((runId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat.cancel', run_id: runId }));
    dispatchRun({ type: 'clear.run', runId });
  }, []);

  const subscribeSession = useCallback((sessionKey: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'session.subscribe', session_key: sessionKey }));
    dispatchRun({ type: 'session.synced', sessionKey });
  }, []);

  return {
    connection,
    reconnectDelayMs,
    events,
    runs,
    sendChat,
    cancelRun,
    subscribeSession,
  };
}
