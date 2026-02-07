import { useEffect, useMemo, useRef, useState } from 'react';

import type { ConnectionState, SessionDetail, StreamRunMessage } from '../../types';
import { ToolActivity } from './ToolActivity';

interface ChatTranscriptProps {
  sessionKey: string;
  detail: SessionDetail | null;
  runMessages: StreamRunMessage[];
  connection: ConnectionState;
}

interface RenderMessage {
  id: string;
  role: string;
  content: string;
  tools?: StreamRunMessage['tools'];
  status?: StreamRunMessage['status'];
  usage?: Record<string, number>;
  error?: string;
}

function asHistoryMessage(detail: SessionDetail | null): RenderMessage[] {
  if (!detail) {
    return [];
  }
  return detail.messages.map((message, index) => ({
    id: `history-${index}`,
    role: message.role,
    content: message.content,
  }));
}

function asRunMessages(runs: StreamRunMessage[]): RenderMessage[] {
  return runs.map((run) => ({
    id: run.runId,
    role: 'assistant',
    content: run.content,
    tools: run.tools,
    status: run.status,
    usage: run.usage,
    error: run.error,
  }));
}

function scrollToLatest(node: HTMLDivElement, behavior: ScrollBehavior): void {
  if (typeof node.scrollTo === 'function') {
    node.scrollTo({ top: node.scrollHeight, behavior });
    return;
  }
  node.scrollTop = node.scrollHeight;
}

export function ChatTranscript({ sessionKey, detail, runMessages, connection }: ChatTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const renderMessages = useMemo(() => {
    const history = asHistoryMessage(detail);
    const runs = asRunMessages(runMessages);
    return [...history, ...runs];
  }, [detail, runMessages]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const handleScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      setIsNearBottom(distance < 120);
    };

    handleScroll();
    node.addEventListener('scroll', handleScroll);
    return () => {
      node.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !isNearBottom) {
      return;
    }
    scrollToLatest(node, 'smooth');
  }, [isNearBottom, renderMessages.length]);

  return (
    <section className="chat-canvas" aria-label="Conversation">
      <header className="chat-head">
        <div>
          <p className="eyebrow">Live Chat</p>
          <h1>{sessionKey}</h1>
        </div>
        <span className={connection === 'connected' ? 'chip chip-ok' : 'chip chip-warn'}>
          {connection === 'connected' ? 'Live' : 'Offline'}
        </span>
      </header>

      <div className="chat-stream" ref={containerRef} role="log" aria-live="polite" aria-label="Chat messages">
        {renderMessages.length === 0 ? (
          <div className="empty-state">
            <h3>Start a conversation</h3>
            <p>Write a prompt below to stream tool-aware responses from pobot.</p>
          </div>
        ) : null}

        {renderMessages.map((message) => (
          <article key={message.id} className={`bubble ${message.role}`}>
            <header className="bubble-head">
              <strong>{message.role}</strong>
              {message.status === 'streaming' ? <span className="pulse-dot" aria-label="Streaming" /> : null}
              {message.status === 'error' ? <span className="chip chip-warn">Error</span> : null}
            </header>
            <pre>{message.content || (message.status === 'streaming' ? 'Streaming response…' : '')}</pre>
            {message.error ? <p className="error-text">{message.error}</p> : null}
            {message.tools ? <ToolActivity steps={message.tools} /> : null}
            {message.usage ? (
              <p className="usage">tokens: {Object.values(message.usage).reduce((sum, value) => sum + value, 0)}</p>
            ) : null}
          </article>
        ))}
      </div>

      {!isNearBottom ? (
        <div className="jump-row">
          <button className="ghost-btn" onClick={() => containerRef.current && scrollToLatest(containerRef.current, 'auto')}>
            Jump to latest
          </button>
        </div>
      ) : null}
    </section>
  );
}
