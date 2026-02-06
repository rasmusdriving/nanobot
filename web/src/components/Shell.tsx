import type { ReactNode } from 'react';

import type { ViewKey } from '../types';

const NAV_ITEMS: Array<{ key: ViewKey; label: string; short: string }> = [
  { key: 'command', label: 'Command Deck', short: 'CMD' },
  { key: 'sessions', label: 'Sessions', short: 'SES' },
  { key: 'schedules', label: 'Schedules', short: 'CRN' },
  { key: 'heartbeat', label: 'Heartbeat', short: 'HBT' },
  { key: 'skills', label: 'Skills', short: 'SKL' },
  { key: 'config', label: 'Config', short: 'CFG' },
  { key: 'diagnostics', label: 'Diagnostics', short: 'DIA' },
];

interface ShellProps {
  view: ViewKey;
  onChangeView: (view: ViewKey) => void;
  activeRuns: number;
  queueDepth: number;
  cronJobs: number;
  children: ReactNode;
}

export function Shell(props: ShellProps) {
  const { view, onChangeView, activeRuns, queueDepth, cronJobs, children } = props;

  return (
    <div className="shell-root">
      <aside className="rail">
        <div className="rail-brand">
          <span className="brand-mark">P</span>
          <div>
            <h1>POBOT</h1>
            <p>Control Room</p>
          </div>
        </div>
        <nav className="rail-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={item.key === view ? 'rail-nav-item active' : 'rail-nav-item'}
              onClick={() => onChangeView(item.key)}
            >
              <span>{item.short}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>
      </aside>
      <main className="deck">
        <header className="pressure-ribbon">
          <section>
            <h2>Run Pressure</h2>
            <p>Live command load and scheduling stress index</p>
          </section>
          <div className="pressure-metrics">
            <div>
              <span>ACTIVE RUNS</span>
              <strong>{activeRuns}</strong>
            </div>
            <div>
              <span>QUEUE DEPTH</span>
              <strong>{queueDepth}</strong>
            </div>
            <div>
              <span>CRON JOBS</span>
              <strong>{cronJobs}</strong>
            </div>
          </div>
        </header>
        <section className="deck-content">{children}</section>
      </main>
      <footer className="mobile-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={item.key === view ? 'mobile-nav-item active' : 'mobile-nav-item'}
            onClick={() => onChangeView(item.key)}
          >
            {item.short}
          </button>
        ))}
      </footer>
    </div>
  );
}
