import type { KeyboardEvent, RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { ConnectionState, CronJob, DrawerPanelKey, SkillItem, WsServerEvent } from '../../types';
import { ConfigPanel } from './panels/ConfigPanel';
import { DiagnosticsPanel } from './panels/DiagnosticsPanel';
import { HeartbeatPanel } from './panels/HeartbeatPanel';
import { OverviewPanel } from './panels/OverviewPanel';
import { SchedulesPanel } from './panels/SchedulesPanel';
import { SkillsPanel } from './panels/SkillsPanel';

const PANELS: Array<{ key: DrawerPanelKey; label: string; detail: string }> = [
  { key: 'overview', label: 'Overview', detail: 'Connection and timeline' },
  { key: 'schedules', label: 'Schedules', detail: 'Cron jobs and runs' },
  { key: 'heartbeat', label: 'Heartbeat', detail: 'Prompt and interval' },
  { key: 'skills', label: 'Skills', detail: 'Tool behavior toggles' },
  { key: 'config', label: 'Config', detail: 'Masked runtime config' },
  { key: 'diagnostics', label: 'Diagnostics', detail: 'Status payloads' },
];

interface UtilityDrawerProps {
  open: boolean;
  expanded: boolean;
  desktopTakeover: boolean;
  panel: DrawerPanelKey;
  onPanelChange: (panel: DrawerPanelKey) => void;
  onClose: () => void;
  onToggleExpanded: () => void;
  connection: ConnectionState;
  reconnectDelayMs: number;
  activeRuns: number;
  queueDepth: number;
  events: WsServerEvent[];
  status: Record<string, unknown>;
  cronJobs: CronJob[];
  heartbeat: { content: string; intervalSeconds: number };
  skills: SkillItem[];
  config: Record<string, unknown>;
  onRefreshAll: () => void;
  onCreateCron: (payload: Record<string, unknown>) => void;
  onPatchCron: (id: string, payload: Record<string, unknown>) => void;
  onRunCron: (id: string) => void;
  onRemoveCron: (id: string) => void;
  onSaveHeartbeat: (content: string) => void;
  onTriggerHeartbeat: () => void;
  onSaveSkills: (settings: Record<string, { enabled: boolean; always: boolean | null }>) => void;
  onSaveConfig: (nextConfig: Record<string, unknown>) => void;
}

interface DrawerPanelsProps {
  panel: DrawerPanelKey;
  connection: ConnectionState;
  reconnectDelayMs: number;
  activeRuns: number;
  queueDepth: number;
  events: WsServerEvent[];
  status: Record<string, unknown>;
  cronJobs: CronJob[];
  heartbeat: { content: string; intervalSeconds: number };
  skills: SkillItem[];
  config: Record<string, unknown>;
  onRefreshAll: () => void;
  onCreateCron: (payload: Record<string, unknown>) => void;
  onPatchCron: (id: string, payload: Record<string, unknown>) => void;
  onRunCron: (id: string) => void;
  onRemoveCron: (id: string) => void;
  onSaveHeartbeat: (content: string) => void;
  onTriggerHeartbeat: () => void;
  onSaveSkills: (settings: Record<string, { enabled: boolean; always: boolean | null }>) => void;
  onSaveConfig: (nextConfig: Record<string, unknown>) => void;
}

function panelClass(activePanel: DrawerPanelKey, key: DrawerPanelKey): string {
  return activePanel === key ? 'drawer-panel active' : 'drawer-panel';
}

function panelTabId(key: DrawerPanelKey): string {
  return `drawer-tab-${key}`;
}

function panelBodyId(key: DrawerPanelKey): string {
  return `drawer-panel-${key}`;
}

function focusPanelTab(key: DrawerPanelKey): void {
  requestAnimationFrame(() => {
    const selector = `button[role="tab"]#${panelTabId(key)}`;
    const element = document.querySelector<HTMLButtonElement>(selector);
    element?.focus();
  });
}

function nextPanelKey(currentKey: DrawerPanelKey, step: number): DrawerPanelKey {
  const index = PANELS.findIndex((item) => item.key === currentKey);
  const next = (index + step + PANELS.length) % PANELS.length;
  return PANELS[next].key;
}

function stepFromKey(key: string): number {
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return 1;
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return -1;
  }
  return 0;
}

function handleNavKey(
  event: KeyboardEvent<HTMLButtonElement>,
  itemKey: DrawerPanelKey,
  onPanelChange: (panel: DrawerPanelKey) => void,
): void {
  let nextKey: DrawerPanelKey | null = null;
  const step = stepFromKey(event.key);
  if (step === 0 && event.key !== 'Home' && event.key !== 'End') {
    return;
  }
  event.preventDefault();
  if (event.key === 'Home') {
    nextKey = PANELS[0].key;
  } else if (event.key === 'End') {
    nextKey = PANELS[PANELS.length - 1].key;
  } else {
    nextKey = nextPanelKey(itemKey, step);
  }
  if (nextKey) {
    onPanelChange(nextKey);
    focusPanelTab(nextKey);
  }
}

function DrawerHeader(props: {
  showExpand: boolean;
  expanded: boolean;
  onRefreshAll: () => void;
  onToggleExpanded: () => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement>;
}) {
  const { showExpand, expanded, onRefreshAll, onToggleExpanded, onClose, closeRef } = props;
  return (
    <header className="drawer-head">
      <div>
        <p className="eyebrow">Operations</p>
        <h2>{showExpand ? 'Utility Drawer' : 'Utilities Workspace'}</h2>
      </div>
      <div className="inline-actions">
        <button className="ghost-btn" onClick={onRefreshAll}>
          Reload
        </button>
        {showExpand ? (
          <button className="ghost-btn" onClick={onToggleExpanded}>
            {expanded ? 'Compact' : 'Expand'}
          </button>
        ) : null}
        <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close drawer">
          ✕
        </button>
      </div>
    </header>
  );
}

function DrawerNav(props: { panel: DrawerPanelKey; onPanelChange: (panel: DrawerPanelKey) => void }) {
  const { panel, onPanelChange } = props;
  return (
    <nav className="drawer-nav" role="tablist" aria-orientation="vertical" aria-label="Operations sections">
      <p className="eyebrow drawer-nav-label">Panels</p>
      {PANELS.map((item) => {
        const active = item.key === panel;
        return (
          <button
            key={item.key}
            role="tab"
            id={panelTabId(item.key)}
            aria-controls={panelBodyId(item.key)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={active ? 'drawer-nav-btn active' : 'drawer-nav-btn'}
            onClick={() => onPanelChange(item.key)}
            onKeyDown={(event) => handleNavKey(event, item.key, onPanelChange)}
          >
            <span className="drawer-nav-title">{item.label}</span>
            <span className="drawer-nav-detail">{item.detail}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DrawerPanelContent(props: DrawerPanelsProps & { panelKey: DrawerPanelKey }) {
  const { panelKey } = props;
  if (panelKey === 'overview') {
    return (
      <OverviewPanel
        connection={props.connection}
        reconnectDelayMs={props.reconnectDelayMs}
        activeRuns={props.activeRuns}
        queueDepth={props.queueDepth}
        cronJobsCount={props.cronJobs.length}
        events={props.events}
      />
    );
  }
  if (panelKey === 'schedules') {
    return (
      <SchedulesPanel
        jobs={props.cronJobs}
        onRefresh={props.onRefreshAll}
        onCreate={props.onCreateCron}
        onPatch={props.onPatchCron}
        onRun={props.onRunCron}
        onDelete={props.onRemoveCron}
      />
    );
  }
  if (panelKey === 'heartbeat') {
    return (
      <HeartbeatPanel
        content={props.heartbeat.content}
        intervalSeconds={props.heartbeat.intervalSeconds}
        onSave={props.onSaveHeartbeat}
        onTrigger={props.onTriggerHeartbeat}
      />
    );
  }
  if (panelKey === 'skills') {
    return <SkillsPanel skills={props.skills} onSave={props.onSaveSkills} />;
  }
  if (panelKey === 'config') {
    return <ConfigPanel maskedConfig={props.config} onSave={props.onSaveConfig} />;
  }
  return <DiagnosticsPanel status={props.status} onRefresh={props.onRefreshAll} />;
}

function DrawerPanels(props: DrawerPanelsProps) {
  return (
    <div className="drawer-content">
      {PANELS.map((item) => (
        <section
          key={item.key}
          role="tabpanel"
          id={panelBodyId(item.key)}
          aria-labelledby={panelTabId(item.key)}
          className={panelClass(props.panel, item.key)}
          hidden={props.panel !== item.key}
        >
          <DrawerPanelContent {...props} panelKey={item.key} />
        </section>
      ))}
    </div>
  );
}

export function UtilityDrawer(props: UtilityDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const showExpand = !props.desktopTakeover;

  useEffect(() => {
    if (props.open) {
      closeRef.current?.focus();
    }
  }, [props.open]);

  return (
    <aside
      className={`utility-drawer ${props.open ? 'open' : ''} ${props.expanded ? 'expanded' : ''} ${props.desktopTakeover ? 'workspace' : ''}`}
      aria-label="Operations drawer"
      hidden={!props.open}
      aria-hidden={!props.open}
    >
      <DrawerHeader
        showExpand={showExpand}
        expanded={props.expanded}
        onRefreshAll={props.onRefreshAll}
        onToggleExpanded={props.onToggleExpanded}
        onClose={props.onClose}
        closeRef={closeRef}
      />
      <div className="drawer-body">
        <DrawerNav panel={props.panel} onPanelChange={props.onPanelChange} />
        <DrawerPanels {...props} />
      </div>
    </aside>
  );
}
