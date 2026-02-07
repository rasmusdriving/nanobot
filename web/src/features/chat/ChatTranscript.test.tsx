import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatTranscript } from './ChatTranscript';
import type { SessionDetail, StreamRunMessage } from '../../types';

function buildDetail(): SessionDetail {
  return {
    key: 'web:test',
    createdAt: '2026-02-06T00:00:00.000Z',
    updatedAt: '2026-02-06T00:00:00.000Z',
    metadata: {},
    path: '/tmp/web-test',
    messages: [
      {
        role: 'user',
        content: 'hello',
      },
    ],
  };
}

function buildRun(id: string, content: string): StreamRunMessage {
  return {
    runId: id,
    sessionKey: 'web:test',
    status: 'streaming',
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [],
  };
}

function setScrollMetrics(node: HTMLElement, values: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
  Object.defineProperty(node, 'scrollHeight', { configurable: true, value: values.scrollHeight });
  Object.defineProperty(node, 'scrollTop', { configurable: true, writable: true, value: values.scrollTop });
  Object.defineProperty(node, 'clientHeight', { configurable: true, value: values.clientHeight });
}

describe('ChatTranscript', () => {
  it('auto-scrolls when user is near the bottom and new messages arrive', () => {
    const view = render(
      <ChatTranscript sessionKey="web:test" detail={buildDetail()} runMessages={[]} connection="connected" />,
    );
    const log = screen.getByRole('log', { name: 'Chat messages' });
    const scrollTo = vi.fn();
    Object.defineProperty(log, 'scrollTo', { configurable: true, value: scrollTo });

    setScrollMetrics(log, { scrollHeight: 1000, scrollTop: 930, clientHeight: 60 });
    fireEvent.scroll(log);

    view.rerender(
      <ChatTranscript
        sessionKey="web:test"
        detail={buildDetail()}
        runMessages={[buildRun('run-1', 'streaming…')]}
        connection="connected"
      />,
    );

    expect(scrollTo).toHaveBeenCalled();
  });

  it('shows jump control when user scrolls away from latest messages', () => {
    render(<ChatTranscript sessionKey="web:test" detail={buildDetail()} runMessages={[]} connection="connected" />);
    const log = screen.getByRole('log', { name: 'Chat messages' });
    const scrollTo = vi.fn();
    Object.defineProperty(log, 'scrollTo', { configurable: true, value: scrollTo });

    setScrollMetrics(log, { scrollHeight: 1000, scrollTop: 80, clientHeight: 300 });
    fireEvent.scroll(log);

    const jumpButton = screen.getByRole('button', { name: 'Jump to latest' });
    fireEvent.click(jumpButton);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  });
});
