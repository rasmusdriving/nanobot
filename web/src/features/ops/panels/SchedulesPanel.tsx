import { FormEvent, useState } from 'react';

import type { CronJob } from '../../../types';

interface SchedulesPanelProps {
  jobs: CronJob[];
  onRefresh: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
  onPatch: (id: string, payload: Record<string, unknown>) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SchedulesPanel(props: SchedulesPanelProps) {
  const { jobs, onRefresh, onCreate, onPatch, onRun, onDelete } = props;
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<'every' | 'cron' | 'at'>('every');
  const [everySeconds, setEverySeconds] = useState('3600');
  const [cronExpr, setCronExpr] = useState('0 9 * * *');
  const [atIso, setAtIso] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, unknown> = { name, message, schedule_kind: kind };
    if (kind === 'every') {
      payload.every_seconds = Number(everySeconds);
    }
    if (kind === 'cron') {
      payload.cron_expr = cronExpr;
    }
    if (kind === 'at') {
      payload.at_iso = atIso;
    }
    onCreate(payload);
    setName('');
    setMessage('');
  }

  return (
    <section className="ops-panel split">
      <article className="ops-card">
        <header className="ops-panel-head">
          <h3>Schedules</h3>
          <button className="ghost-btn" onClick={onRefresh}>
            Refresh
          </button>
        </header>
        <div className="ops-list">
          {jobs.length === 0 ? <p className="muted">No jobs configured.</p> : null}
          {jobs.map((job) => (
            <div key={job.id} className="ops-row">
              <div>
                <strong>{job.name}</strong>
                <p className="muted mono">{job.id}</p>
                <p>{job.payload.message}</p>
              </div>
              <div>
                <p>{job.schedule.kind}</p>
                <p className="muted mono">{job.schedule.expr ?? `${(job.schedule.everyMs ?? 0) / 1000}s`}</p>
              </div>
              <div className="stack-actions">
                <button className="ghost-btn" onClick={() => onPatch(job.id, { enabled: !job.enabled })}>
                  {job.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="ghost-btn" onClick={() => onRun(job.id)}>
                  Run
                </button>
                <button className="ghost-btn danger" onClick={() => onDelete(job.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="ops-card">
        <h3>Create schedule</h3>
        <form onSubmit={submit} className="settings-grid">
          <label className="field">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <label className="field full">
            Message
            <textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} required />
          </label>

          <label className="field">
            Kind
            <select value={kind} onChange={(event) => setKind(event.target.value as 'every' | 'cron' | 'at')}>
              <option value="every">Every</option>
              <option value="cron">Cron</option>
              <option value="at">At</option>
            </select>
          </label>

          {kind === 'every' ? (
            <label className="field">
              Every seconds
              <input value={everySeconds} onChange={(event) => setEverySeconds(event.target.value)} />
            </label>
          ) : null}

          {kind === 'cron' ? (
            <label className="field">
              Cron expression
              <input value={cronExpr} onChange={(event) => setCronExpr(event.target.value)} />
            </label>
          ) : null}

          {kind === 'at' ? (
            <label className="field">
              ISO time
              <input value={atIso} onChange={(event) => setAtIso(event.target.value)} placeholder="2026-02-06T20:00:00" />
            </label>
          ) : null}

          <button type="submit" className="glass-btn">
            Add job
          </button>
        </form>
      </article>
    </section>
  );
}
