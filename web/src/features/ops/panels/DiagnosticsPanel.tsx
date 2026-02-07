interface DiagnosticsPanelProps {
  status: Record<string, unknown>;
  onRefresh: () => void;
}

export function DiagnosticsPanel({ status, onRefresh }: DiagnosticsPanelProps) {
  return (
    <section className="ops-panel">
      <header className="ops-panel-head">
        <h3>Diagnostics</h3>
        <button className="ghost-btn" onClick={onRefresh}>
          Refresh
        </button>
      </header>

      <pre className="long-editor mono" aria-label="Runtime diagnostics">
        {JSON.stringify(status, null, 2)}
      </pre>
    </section>
  );
}
