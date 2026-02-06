import { useEffect, useState } from 'react';

interface HeartbeatPanelProps {
  content: string;
  intervalSeconds: number;
  onSave: (content: string) => void;
  onTrigger: () => void;
}

export function HeartbeatPanel({ content, intervalSeconds, onSave, onTrigger }: HeartbeatPanelProps) {
  const [draft, setDraft] = useState(content);
  useEffect(() => {
    setDraft(content);
  }, [content]);

  return (
    <div className="panel-grid">
      <article className="panel card-lg">
        <h3>Heartbeat Directive File</h3>
        <p className="muted">Tick interval: {intervalSeconds}s</p>
        <textarea
          className="heartbeat-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={18}
          placeholder="# HEARTBEAT\n- [ ] Check pending tasks"
        />
        <div className="toolbar">
          <button className="btn primary" onClick={() => onSave(draft)}>
            Save HEARTBEAT.md
          </button>
          <button className="btn" onClick={onTrigger}>
            Trigger Now
          </button>
          <button className="btn" onClick={() => setDraft(content)}>
            Reset
          </button>
        </div>
      </article>
    </div>
  );
}
