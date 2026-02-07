import { FormEvent, KeyboardEvent, useState } from 'react';

interface ChatComposerProps {
  connected: boolean;
  activeRunId: string | null;
  sessionKey: string;
  channel: string;
  chatId: string;
  onSessionKeyChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onChatIdChange: (value: string) => void;
  onSend: (content: string, sessionKey: string) => void;
  onCancel: (runId: string) => void;
}

export function ChatComposer(props: ChatComposerProps) {
  const {
    connected,
    activeRunId,
    sessionKey,
    channel,
    chatId,
    onSessionKeyChange,
    onChannelChange,
    onChatIdChange,
    onSend,
    onCancel,
  } = props;

  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  function submitMessage() {
    if (!connected || !message.trim()) {
      return;
    }
    const normalizedSessionKey = sessionKey.trim() || 'web:control-room';
    onSend(message.trim(), normalizedSessionKey);
    setMessage('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <section className="composer-shell">
      <form onSubmit={submit} className="composer-form">
        <label className="composer-field">
          <span className="sr-only">Message</span>
          <textarea
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask pobot to perform a task, inspect state, or run tools…"
          />
        </label>

        <div className="composer-actions">
          <button type="submit" className="glass-btn" disabled={!connected || !message.trim()}>
            Send
          </button>
          <button type="button" className="ghost-btn" disabled={!activeRunId} onClick={() => activeRunId && onCancel(activeRunId)}>
            Stop
          </button>
          <button type="button" className="ghost-btn" onClick={() => setShowSettings((value) => !value)}>
            {showSettings ? 'Hide run settings' : 'Run settings'}
          </button>
        </div>

        {showSettings ? (
          <div className="settings-grid">
            <label className="field">
              Session key
              <input value={sessionKey} onChange={(event) => onSessionKeyChange(event.target.value)} />
            </label>
            <label className="field">
              Channel
              <input value={channel} onChange={(event) => onChannelChange(event.target.value)} />
            </label>
            <label className="field">
              Chat ID
              <input value={chatId} onChange={(event) => onChatIdChange(event.target.value)} />
            </label>
          </div>
        ) : null}
      </form>
    </section>
  );
}
