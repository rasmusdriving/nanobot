import type { ConnectionState, WsServerEvent } from '../../../types';

interface OverviewPanelProps {
  connection: ConnectionState;
  reconnectDelayMs: number;
  activeRuns: number;
  queueDepth: number;
  cronJobsCount: number;
  events: WsServerEvent[];
}

function describeEvent(event: WsServerEvent): string {
  if (event.type === 'tool.start') {
    return `${event.tool_name ?? 'tool'} started`;
  }
  if (event.type === 'tool.end') {
    return `${event.tool_name ?? 'tool'} finished`;
  }
  if (event.type === 'chat.delta') {
    return event.text_delta ?? '';
  }
  if (event.type === 'chat.final') {
    return event.full_text ?? '';
  }
  return event.message ?? '';
}

export function OverviewPanel(props: OverviewPanelProps) {
  const { connection, reconnectDelayMs, activeRuns, queueDepth, cronJobsCount, events } = props;
  const recent = [...events].slice(-40).reverse();

  return (
    <section className="ops-panel">
      <header className="ops-panel-head">
        <h3>Overview</h3>
        <span className={connection === 'connected' ? 'chip chip-ok' : 'chip chip-warn'}>
          {connection === 'connected' ? 'Connected' : `Reconnecting ${reconnectDelayMs}ms`}
        </span>
      </header>

      <div className="metric-grid">
        <article>
          <p>Active runs</p>
          <strong>{activeRuns}</strong>
        </article>
        <article>
          <p>Queue depth</p>
          <strong>{queueDepth}</strong>
        </article>
        <article>
          <p>Cron jobs</p>
          <strong>{cronJobsCount}</strong>
        </article>
      </div>

      <div className="timeline-list" role="list" aria-label="Event timeline">
        {recent.length === 0 ? <p className="muted">No events yet.</p> : null}
        {recent.map((event, index) => (
          <article key={`${event.type}-${index}`} className="timeline-item" role="listitem">
            <header>
              <strong>{event.type}</strong>
              {event.run_id ? <span className="muted">run {event.run_id}</span> : null}
            </header>
            <p>{describeEvent(event)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
