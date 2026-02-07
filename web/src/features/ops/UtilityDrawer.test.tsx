import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UtilityDrawer } from './UtilityDrawer';
import type { DrawerPanelKey } from '../../types';

const HEARTBEAT = { content: '# HEARTBEAT\n- [ ] baseline', intervalSeconds: 60 };
const CONFIG = { agents: { defaults: { model: 'dummy' } } };

function DrawerHarness({ open = true, desktopTakeover = false }: { open?: boolean; desktopTakeover?: boolean }) {
  const [panel, setPanel] = useState<DrawerPanelKey>('overview');

  return (
    <UtilityDrawer
      open={open}
      expanded={false}
      desktopTakeover={desktopTakeover}
      panel={panel}
      onPanelChange={setPanel}
      onClose={vi.fn()}
      onToggleExpanded={vi.fn()}
      connection="connected"
      reconnectDelayMs={0}
      activeRuns={0}
      queueDepth={0}
      events={[]}
      status={{}}
      cronJobs={[]}
      heartbeat={HEARTBEAT}
      skills={[]}
      config={CONFIG}
      onRefreshAll={vi.fn()}
      onCreateCron={vi.fn()}
      onPatchCron={vi.fn()}
      onRunCron={vi.fn()}
      onRemoveCron={vi.fn()}
      onSaveHeartbeat={vi.fn()}
      onTriggerHeartbeat={vi.fn()}
      onSaveSkills={vi.fn()}
      onSaveConfig={vi.fn()}
    />
  );
}

describe('UtilityDrawer', () => {
  it('does not expose utility navigation when closed', () => {
    render(<DrawerHarness open={false} />);
    expect(screen.queryByRole('tablist', { name: 'Operations sections' })).not.toBeInTheDocument();
  });

  it('renders vertical tab navigation with active section semantics', () => {
    render(<DrawerHarness />);

    const nav = screen.getByRole('tablist', { name: 'Operations sections' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /schedules/i }));
    expect(screen.getByRole('tab', { name: /schedules/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('uses workspace variant without expand control in desktop takeover mode', () => {
    const { container } = render(<DrawerHarness desktopTakeover />);
    expect(container.querySelector('.utility-drawer.workspace')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /expand|compact/i })).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation through utility sections', () => {
    render(<DrawerHarness />);

    const overview = screen.getByRole('tab', { name: /overview/i });
    fireEvent.keyDown(overview, { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: /schedules/i })).toHaveAttribute('aria-selected', 'true');

    const schedules = screen.getByRole('tab', { name: /schedules/i });
    fireEvent.keyDown(schedules, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /heartbeat/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps heartbeat and config drafts when switching panels', () => {
    render(<DrawerHarness />);

    fireEvent.click(screen.getByRole('tab', { name: /heartbeat/i }));
    const heartbeatEditor = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(heartbeatEditor.value).toContain('baseline');
    fireEvent.change(heartbeatEditor, { target: { value: '# HEARTBEAT\n- [ ] edited' } });

    fireEvent.click(screen.getByRole('tab', { name: /config/i }));
    const configEditor = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(configEditor, { target: { value: '{"agents":{"defaults":{"model":"edited"}}}' } });

    fireEvent.click(screen.getByRole('tab', { name: /heartbeat/i }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('# HEARTBEAT\n- [ ] edited');

    fireEvent.click(screen.getByRole('tab', { name: /config/i }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('{"agents":{"defaults":{"model":"edited"}}}');
  });
});
