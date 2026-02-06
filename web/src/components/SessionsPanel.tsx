import { useMemo, useState } from 'react';

import type { SessionDetail, SessionSummary } from '../types';

interface SessionsPanelProps {
  sessions: SessionSummary[];
  detail: SessionDetail | null;
  onRefresh: () => void;
  onOpen: (key: string) => void;
  onDelete: (key: string) => void;
}

export function SessionsPanel({ sessions, detail, onRefresh, onOpen, onDelete }: SessionsPanelProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return sessions;
    }
    return sessions.filter((session) => session.key.toLowerCase().includes(text));
  }, [query, sessions]);

  return (
    <div className="panel-grid sessions-grid">
      <article className="panel">
        <div className="panel-head">
          <h3>Session Ledger</h3>
          <button className="btn" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <input
          className="search"
          placeholder="Search sessions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="session-list">
          {filtered.map((session) => (
            <div key={session.key} className="session-row">
              <button onClick={() => onOpen(session.key)}>{session.key}</button>
              <small>{session.updated_at ?? 'unknown'}</small>
              <button className="btn danger" onClick={() => onDelete(session.key)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </article>

      <article className="panel card-lg">
        <h3>Transcript</h3>
        {!detail ? <p className="muted">Select a session to inspect messages.</p> : null}
        {detail ? (
          <>
            <p className="muted">{detail.key}</p>
            <div className="transcript">
              {detail.messages.map((msg, idx) => (
                <div key={`${msg.role}-${idx}`} className={`bubble ${msg.role}`}>
                  <strong>{msg.role}</strong>
                  <pre>{msg.content}</pre>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </article>
    </div>
  );
}
