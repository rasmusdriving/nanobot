import { FormEvent, useMemo, useState } from 'react';

import type { WsServerEvent } from '../types';

interface CommandDeckProps {
  connected: boolean;
  events: WsServerEvent[];
  onSend: (payload: { content: string; session_key: string; channel: string; chat_id: string }) => void;
  onCancel: (runId: string) => void;
}

export function CommandDeck({ connected, events, onSend, onCancel }: CommandDeckProps) {
  const [content, setContent] = useState('');
  const [sessionKey, setSessionKey] = useState('web:control-room');
  const [channel, setChannel] = useState('cli');
  const [chatId, setChatId] = useState('web');

  const activeRun = useMemo(() => {
    const ack = [...events].reverse().find((evt) => evt.type === 'chat.ack' && evt.run_id);
    return ack?.run_id ?? '';
  }, [events]);

  const streamText = useMemo(() => {
    return events
      .filter((evt) => evt.type === 'chat.delta')
      .map((evt) => evt.text_delta ?? '')
      .join('');
  }, [events]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    onSend({
      content: content.trim(),
      session_key: sessionKey.trim() || 'web:control-room',
      channel: channel.trim() || 'cli',
      chat_id: chatId.trim() || 'web',
    });
    setContent('');
  }

  return (
    <div className="panel-grid command-grid">
      <article className="panel card-lg">
        <h3>Live Prompt Injector</h3>
        <form onSubmit={submit} className="form-grid">
          <label>
            Session Key
            <input value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} placeholder="web:control-room" />
          </label>
          <label>
            Channel
            <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="cli" />
          </label>
          <label>
            Chat ID
            <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="web" />
          </label>
          <label className="form-span">
            Message
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Ask pobot to perform a task..." />
          </label>
          <div className="toolbar">
            <button type="submit" className="btn primary" disabled={!connected}>
              Send Streamed Run
            </button>
            <button
              type="button"
              className="btn"
              disabled={!activeRun}
              onClick={() => activeRun && onCancel(activeRun)}
            >
              Cancel Active Run
            </button>
            <span className={connected ? 'status-dot on' : 'status-dot off'}>
              {connected ? 'WS ONLINE' : 'WS OFFLINE'}
            </span>
          </div>
        </form>
      </article>

      <article className="panel">
        <h3>Streaming Output</h3>
        <pre className="stream-output" aria-live="polite">
          {streamText || 'Waiting for streamed output...'}
        </pre>
      </article>

      <article className="panel">
        <h3>Tool Timeline</h3>
        <div className="timeline">
          {events.length === 0 ? <p className="muted">No events yet.</p> : null}
          {events.map((evt, idx) => (
            <div key={`${evt.type}-${idx}`} className="timeline-item">
              <strong>{evt.type}</strong>
              {evt.tool_name ? <span>{evt.tool_name}</span> : null}
              {evt.message ? <p>{evt.message}</p> : null}
              {evt.result_preview ? <p>{evt.result_preview}</p> : null}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
