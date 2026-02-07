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
    <section className="ops-panel">
      <header className="ops-panel-head">
        <h3>Heartbeat</h3>
        <p className="muted">Tick interval: {intervalSeconds}s</p>
      </header>

      <textarea
        className="long-editor mono"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={18}
        placeholder="# HEARTBEAT\n- [ ] Check pending tasks"
      />

      <div className="inline-actions">
        <button className="glass-btn" onClick={() => onSave(draft)}>
          Save HEARTBEAT.md
        </button>
        <button className="ghost-btn" onClick={onTrigger}>
          Trigger now
        </button>
        <button className="ghost-btn" onClick={() => setDraft(content)}>
          Reset
        </button>
      </div>
    </section>
  );
}
