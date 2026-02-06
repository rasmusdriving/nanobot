import { useEffect, useState } from 'react';

interface ConfigPanelProps {
  maskedConfig: unknown;
  onSave: (payload: Record<string, unknown>) => void;
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
    <div className="panel-grid">
      <article className="panel card-lg">
        <h3>Config Control</h3>
        <p className="muted">Masked secrets are shown as obfuscated values and retained unless replaced.</p>
        <textarea className="config-editor" value={text} onChange={(e) => setText(e.target.value)} rows={22} />
        {error ? <p className="error">{error}</p> : null}
        <div className="toolbar">
          <button className="btn primary" onClick={submit}>
            Save Config
          </button>
        </div>
      </article>
    </div>
  );
}
