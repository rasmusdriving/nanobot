import { useCallback, useEffect, useRef } from 'react';

import type { RunStreamState, StreamRunMessage } from '../../types';
import { useControlRoomData } from './useControlRoomData';
import { useControlRoomSocket } from './useControlRoomSocket';

export function useControlRoomState() {
  const data = useControlRoomData();
  const {
    token,
    pushNotice,
    refreshSessions,
    selectedSessionKey,
    sessions,
    loadSessionDetail,
    channel,
    chatId,
  } = data;
  const selectedSessionRef = useRef(selectedSessionKey);

  useEffect(() => {
    selectedSessionRef.current = selectedSessionKey;
  }, [selectedSessionKey]);

  const handleSessionUpdated = useCallback(
    (sessionKey: string) => {
      void refreshSessions();
      if (sessionKey === selectedSessionRef.current) {
        void loadSessionDetail(sessionKey);
      }
    },
    [loadSessionDetail, refreshSessions],
  );

  const socket = useControlRoomSocket({
    token,
    onSessionUpdated: handleSessionUpdated,
    onError: pushNotice,
  });

  useEffect(() => {
    const exists = sessions.some((item) => item.key === selectedSessionKey);
    if (!exists) {
      return;
    }
    void loadSessionDetail(selectedSessionKey, socket.subscribeSession);
  }, [loadSessionDetail, selectedSessionKey, sessions, socket.subscribeSession]);

  return {
    ...data,
    connection: socket.connection,
    reconnectDelayMs: socket.reconnectDelayMs,
    events: socket.events,
    runs: socket.runs,
    sendChat: (content: string, sessionKey: string) => socket.sendChat(content, sessionKey, channel, chatId),
    cancelRun: socket.cancelRun,
  };
}

export function selectRunMessagesForSession(runs: RunStreamState, sessionKey: string): StreamRunMessage[] {
  return runs.order
    .map((runId) => runs.runs[runId])
    .filter((run): run is StreamRunMessage => Boolean(run && run.sessionKey === sessionKey));
}
