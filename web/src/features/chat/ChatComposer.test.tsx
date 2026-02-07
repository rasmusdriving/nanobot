import type { ComponentProps } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatComposer } from './ChatComposer';

function renderComposer(overrides?: Partial<ComponentProps<typeof ChatComposer>>) {
  const onSend = vi.fn();
  const onCancel = vi.fn();
  const onSessionKeyChange = vi.fn();
  const onChannelChange = vi.fn();
  const onChatIdChange = vi.fn();

  render(
    <ChatComposer
      connected
      activeRunId={null}
      sessionKey="web:test"
      channel="cli"
      chatId="web"
      onSessionKeyChange={onSessionKeyChange}
      onChannelChange={onChannelChange}
      onChatIdChange={onChatIdChange}
      onSend={onSend}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSend, onCancel };
}

describe('ChatComposer', () => {
  it('disables send when websocket is offline', () => {
    renderComposer({ connected: false });
    const sendButton = screen.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeDisabled();
  });

  it('calls cancel with active run id', () => {
    const { onCancel } = renderComposer({ activeRunId: 'run-42' });
    const stopButton = screen.getByRole('button', { name: 'Stop' });
    fireEvent.click(stopButton);
    expect(onCancel).toHaveBeenCalledWith('run-42');
  });
});
