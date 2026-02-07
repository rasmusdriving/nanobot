import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

const mockUseControlRoomState = vi.fn();

vi.mock('./features/control-room/useControlRoomState', () => ({
  useControlRoomState: () => mockUseControlRoomState(),
  selectRunMessagesForSession: () => [],
}));

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function buildState() {
  return {
    tokenDraft: '',
    setTokenDraft: vi.fn(),
    applyToken: vi.fn(),
    refreshAll: vi.fn(),
    notice: '',
    clearNotice: vi.fn(),
    sessions: [],
    selectedSessionKey: 'web:control-room',
    setSelectedSessionKey: vi.fn(),
    deleteSession: vi.fn(),
    refreshSessions: vi.fn(),
    createThread: vi.fn(),
    sessionDetail: null,
    connection: 'connected' as const,
    activeRuns: 0,
    queueDepth: 0,
    cronJobs: [],
    reconnectDelayMs: 0,
    events: [],
    status: {},
    heartbeat: { content: '', intervalSeconds: 1800 },
    skills: [],
    config: {},
    createCron: vi.fn(),
    patchCron: vi.fn(),
    runCron: vi.fn(),
    removeCron: vi.fn(),
    saveHeartbeat: vi.fn(),
    triggerHeartbeat: vi.fn(),
    saveSkills: vi.fn(),
    saveConfig: vi.fn(),
    channel: 'cli',
    chatId: 'web',
    runs: {
      order: [],
      runs: {},
      activeRunBySession: {},
    },
    sendChat: vi.fn(),
    cancelRun: vi.fn(),
  };
}

describe('App desktop utilities takeover mode', () => {
  beforeEach(() => {
    mockUseControlRoomState.mockReset();
    mockUseControlRoomState.mockReturnValue(buildState());
  });

  it('enters desktop takeover mode and closes on Escape with focus restore', () => {
    setViewport(1400);
    const { container } = render(<App />);

    const utilitiesButton = screen.getByRole('button', { name: 'Utilities' });
    const threadsButton = screen.getByRole('button', { name: 'Threads' });

    fireEvent.click(utilitiesButton);

    const workspace = container.querySelector('.workspace-grid');
    const chatColumn = container.querySelector('.chat-column');
    const threadRail = container.querySelector('.thread-rail');

    expect(workspace).toHaveClass('desktop-utilities-mode');
    expect(threadsButton).toBeDisabled();
    expect(chatColumn).toHaveAttribute('hidden');
    expect(threadRail).toHaveAttribute('hidden');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(utilitiesButton).toHaveAttribute('aria-pressed', 'false');
    expect(threadsButton).not.toBeDisabled();
    expect(document.activeElement).toBe(utilitiesButton);
  });

  it('keeps non-desktop behavior below takeover breakpoint', () => {
    setViewport(1024);
    const { container } = render(<App />);

    const utilitiesButton = screen.getByRole('button', { name: 'Utilities' });
    const threadsButton = screen.getByRole('button', { name: 'Threads' });
    fireEvent.click(utilitiesButton);

    const workspace = container.querySelector('.workspace-grid');
    expect(workspace).not.toHaveClass('desktop-utilities-mode');
    expect(threadsButton).not.toBeDisabled();
  });
});
