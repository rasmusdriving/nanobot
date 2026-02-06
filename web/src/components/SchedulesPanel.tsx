import { FormEvent, useState } from 'react';

import type { CronJob } from '../types';

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
    const payload: Record<string, unknown> = {
      name,
      message,
      schedule_kind: kind,
    };
    if (kind === 'every') payload.every_seconds = Number(everySeconds);
    if (kind === 'cron') payload.cron_expr = cronExpr;
    if (kind === 'at') payload.at_iso = atIso;
    onCreate(payload);
    setName('');
    setMessage('');
  }

  return (
    <div className="panel-grid schedules-grid">
      <article className="panel">
        <div className="panel-head">
          <h3>Cron Matrix</h3>
          <button className="btn" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <div className="cron-table">
          {jobs.map((job) => (
            <div key={job.id} className="cron-row">
              <div>
                <strong>{job.name}</strong>
                <p className="muted">{job.id}</p>
                <p>{job.payload.message}</p>
              </div>
              <div>
                <small>{job.schedule.kind}</small>
                <small>{job.schedule.expr ?? `${(job.schedule.everyMs ?? 0) / 1000}s`}</small>
                <small>{job.state.nextRunAtMs ? new Date(job.state.nextRunAtMs).toLocaleString() : 'paused'}</small>
              </div>
              <div className="cron-actions">
                <button className="btn" onClick={() => onPatch(job.id, { enabled: !job.enabled })}>
                  {job.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="btn" onClick={() => onRun(job.id)}>
                  Run
                </button>
                <button className="btn danger" onClick={() => onDelete(job.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <h3>Create Schedule</h3>
        <form className="form-grid" onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="form-span">
            Message
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required />
          </label>
          <label>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as 'every' | 'cron' | 'at')}>
              <option value="every">Every</option>
              <option value="cron">Cron</option>
              <option value="at">At</option>
            </select>
          </label>
          {kind === 'every' ? (
            <label>
              Every seconds
              <input value={everySeconds} onChange={(e) => setEverySeconds(e.target.value)} />
            </label>
          ) : null}
          {kind === 'cron' ? (
            <label>
              Cron expression
              <input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
            </label>
          ) : null}
          {kind === 'at' ? (
            <label>
              At ISO
              <input value={atIso} onChange={(e) => setAtIso(e.target.value)} placeholder="2026-02-06T20:00:00" />
            </label>
          ) : null}
          <div className="toolbar">
            <button className="btn primary" type="submit">
              Add Job
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
