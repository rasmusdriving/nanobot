interface DiagnosticsPanelProps {
  status: Record<string, unknown>;
  onRefresh: () => void;
}

export function DiagnosticsPanel({ status, onRefresh }: DiagnosticsPanelProps) {
  return (
    <div className="panel-grid">
      <article className="panel card-lg">
        <div className="panel-head">
          <h3>Runtime Diagnostics</h3>
          <button className="btn" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <pre className="diagnostics-json">{JSON.stringify(status, null, 2)}</pre>
      </article>
    </div>
  );
}
