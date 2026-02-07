import { useEffect, useState } from 'react';

interface ConfigPanelProps {
  maskedConfig: Record<string, unknown>;
  onSave: (nextConfig: Record<string, unknown>) => void;
}

export function ConfigPanel({ maskedConfig, onSave }: ConfigPanelProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setText(JSON.stringify(maskedConfig, null, 2));
  }, [maskedConfig]);

  function submit() {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setError('');
      onSave(parsed);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
    }
  }

  return (
    <section className="ops-panel">
      <header className="ops-panel-head">
        <h3>Config</h3>
        <p className="muted">Masked secrets stay unchanged unless overwritten.</p>
      </header>

      <textarea className="long-editor mono" rows={22} value={text} onChange={(event) => setText(event.target.value)} />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="inline-actions">
        <button className="glass-btn" onClick={submit}>
          Save config
        </button>
      </div>
    </section>
  );
}
