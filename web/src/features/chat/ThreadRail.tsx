import { useMemo, useState } from 'react';

import type { SessionSummary } from '../../types';

interface ThreadRailProps {
  sessions: SessionSummary[];
  activeSessionKey: string;
  onSelect: (sessionKey: string) => void;
  onDelete: (sessionKey: string) => void;
  onRefresh: () => void;
  onCreateThread: () => void;
  open: boolean;
  hidden?: boolean;
  ariaHidden?: boolean;
  onClose: () => void;
}

function toSortableTime(session: SessionSummary): number {
  const value = session.updated_at ?? session.created_at;
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ThreadRail(props: ThreadRailProps) {
  const { sessions, activeSessionKey, onSelect, onDelete, onRefresh, onCreateThread, open, hidden = false, ariaHidden = false, onClose } = props;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...sessions].sort((a, b) => toSortableTime(b) - toSortableTime(a));
    if (!normalized) {
      return sorted;
    }
    return sorted.filter((session) => session.key.toLowerCase().includes(normalized));
  }, [query, sessions]);

  const hasDraftSession = activeSessionKey && !sessions.some((session) => session.key === activeSessionKey);

  return (
    <aside className={`thread-rail ${open ? 'open' : ''}`} aria-label="Sessions" hidden={hidden} aria-hidden={ariaHidden}>
      <header className="thread-rail-head">
        <div>
          <p className="eyebrow">Sessions</p>
          <h2>Threads</h2>
        </div>
        <button className="icon-btn close-btn" onClick={onClose} aria-label="Close threads panel">
          ✕
        </button>
      </header>

      <div className="thread-rail-actions">
        <button className="glass-btn" onClick={onCreateThread}>
          New Thread
        </button>
        <button className="ghost-btn" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <label className="field">
        Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find session key" />
      </label>

      <div className="thread-list" role="listbox" aria-label="Session threads">
        {hasDraftSession ? (
          <button className="thread-item active" onClick={() => onSelect(activeSessionKey)} role="option" aria-selected="true">
            <strong>{activeSessionKey}</strong>
            <span>Draft thread</span>
          </button>
        ) : null}

        {filtered.map((session) => {
          const isActive = activeSessionKey === session.key;
          return (
            <div key={session.key} className={isActive ? 'thread-row active' : 'thread-row'}>
              <button className="thread-item" onClick={() => onSelect(session.key)} role="option" aria-selected={isActive}>
                <strong>{session.key}</strong>
                <span>{session.updated_at ? new Date(session.updated_at).toLocaleString() : 'No updates yet'}</span>
              </button>
              <button className="ghost-btn danger" onClick={() => onDelete(session.key)} aria-label={`Delete ${session.key}`}>
                Delete
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && !hasDraftSession ? <p className="muted">No sessions match your search.</p> : null}
      </div>
    </aside>
  );
}
