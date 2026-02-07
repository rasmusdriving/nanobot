import { useEffect, useMemo, useRef, useState } from 'react';

import { ChatComposer } from './features/chat/ChatComposer';
import { ChatTranscript } from './features/chat/ChatTranscript';
import { ThreadRail } from './features/chat/ThreadRail';
import { selectRunMessagesForSession, useControlRoomState } from './features/control-room/useControlRoomState';
import { UtilityDrawer } from './features/ops/UtilityDrawer';
import { TokenPopover } from './features/topbar/TokenPopover';
import type { DrawerPanelKey } from './types';

const DESKTOP_UTILITIES_BREAKPOINT = 1200;

function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth >= DESKTOP_UTILITIES_BREAKPOINT;
}

function App() {
  const state = useControlRoomState();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [drawerPanel, setDrawerPanel] = useState<DrawerPanelKey>('overview');
  const [threadRailOpen, setThreadRailOpen] = useState(false);
  const [showTokenPopover, setShowTokenPopover] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(isDesktopViewport);
  const utilitiesButtonRef = useRef<HTMLButtonElement>(null);
  const tokenButtonRef = useRef<HTMLButtonElement>(null);

  const runMessages = useMemo(
    () => selectRunMessagesForSession(state.runs, state.selectedSessionKey),
    [state.runs, state.selectedSessionKey],
  );

  const activeRunId = state.runs.activeRunBySession[state.selectedSessionKey] ?? null;
  const desktopUtilitiesMode = drawerOpen && desktopViewport;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleResize = () => setDesktopViewport(isDesktopViewport());
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!desktopUtilitiesMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || showTokenPopover) {
        return;
      }
      event.preventDefault();
      setDrawerOpen(false);
      utilitiesButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [desktopUtilitiesMode, showTokenPopover]);

  function closeTokenPopover() {
    setShowTokenPopover(false);
  }

  function toggleThreadRail() {
    setThreadRailOpen((value) => !value);
    setDrawerOpen(false);
    closeTokenPopover();
  }

  function openDrawer(panel: DrawerPanelKey) {
    setThreadRailOpen(false);
    setDrawerPanel(panel);
    setDrawerOpen((value) => (panel === drawerPanel ? !value : true));
    closeTokenPopover();
  }

  function closeDrawer() {
    setDrawerOpen(false);
    utilitiesButtonRef.current?.focus();
  }

  function handleSessionSelect(sessionKey: string) {
    state.setSelectedSessionKey(sessionKey);
    setThreadRailOpen(false);
    closeTokenPopover();
  }

  function handleSend(content: string, sessionKey: string) {
    state.setSelectedSessionKey(sessionKey);
    state.sendChat(content, sessionKey);
  }

  return (
    <div className="cr-app">
      <div className="background-glow" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-row">
          <span className="brand-badge">P</span>
          <div>
            <p className="eyebrow">Pobot</p>
            <h1>Control Room</h1>
          </div>
        </div>

        <div className="chip-row">
          <span className={state.connection === 'connected' ? 'chip chip-ok' : 'chip chip-warn'}>{state.connection}</span>
          <span className="chip">runs {state.activeRuns}</span>
          <span className="chip">queue {state.queueDepth}</span>
          <span className="chip">cron {state.cronJobs.length}</span>
        </div>

        <div className="topbar-actions">
          <button className="ghost-btn" onClick={toggleThreadRail} aria-pressed={threadRailOpen} disabled={desktopUtilitiesMode}>
            Threads
          </button>
          <button ref={utilitiesButtonRef} className="ghost-btn" onClick={() => openDrawer('overview')} aria-pressed={drawerOpen}>
            Utilities
          </button>

          <div className="token-wrap">
            <button
              ref={tokenButtonRef}
              className="ghost-btn"
              aria-expanded={showTokenPopover}
              aria-haspopup="dialog"
              aria-controls="token-popover"
              onClick={() => setShowTokenPopover((value) => !value)}
            >
              Token
            </button>
          </div>
        </div>
      </header>

      <TokenPopover
        open={showTokenPopover}
        anchorRef={tokenButtonRef}
        tokenDraft={state.tokenDraft}
        onTokenDraftChange={state.setTokenDraft}
        onApply={() => {
          state.applyToken();
          closeTokenPopover();
        }}
        onReload={() => void state.refreshAll()}
        onClose={closeTokenPopover}
      />

      {state.notice ? (
        <aside className="notice-banner" role="status">
          <p>{state.notice}</p>
          <button className="icon-btn" onClick={state.clearNotice} aria-label="Dismiss notice">
            ✕
          </button>
        </aside>
      ) : null}

      <div className={`workspace-grid ${drawerOpen ? 'drawer-open' : ''} ${desktopUtilitiesMode ? 'desktop-utilities-mode' : ''}`}>
        <ThreadRail
          sessions={state.sessions}
          activeSessionKey={state.selectedSessionKey}
          onSelect={handleSessionSelect}
          onDelete={(key) => void state.deleteSession(key)}
          onRefresh={() => void state.refreshSessions()}
          onCreateThread={() => {
            state.createThread();
            setThreadRailOpen(false);
          }}
          open={threadRailOpen}
          hidden={desktopUtilitiesMode}
          ariaHidden={desktopUtilitiesMode}
          onClose={() => setThreadRailOpen(false)}
        />

        <main className="chat-column" hidden={desktopUtilitiesMode} aria-hidden={desktopUtilitiesMode}>
          <ChatTranscript
            sessionKey={state.selectedSessionKey}
            detail={state.sessionDetail}
            runMessages={runMessages}
            connection={state.connection}
          />
          <ChatComposer
            connected={state.connection === 'connected'}
            activeRunId={activeRunId}
            sessionKey={state.selectedSessionKey}
            channel={state.channel}
            chatId={state.chatId}
            onSessionKeyChange={state.setSelectedSessionKey}
            onChannelChange={state.setChannel}
            onChatIdChange={state.setChatId}
            onSend={handleSend}
            onCancel={state.cancelRun}
          />
        </main>

        <UtilityDrawer
          open={drawerOpen}
          expanded={drawerExpanded}
          desktopTakeover={desktopUtilitiesMode}
          panel={drawerPanel}
          onPanelChange={setDrawerPanel}
          onClose={closeDrawer}
          onToggleExpanded={() => setDrawerExpanded((value) => !value)}
          connection={state.connection}
          reconnectDelayMs={state.reconnectDelayMs}
          activeRuns={state.activeRuns}
          queueDepth={state.queueDepth}
          events={state.events}
          status={state.status}
          cronJobs={state.cronJobs}
          heartbeat={state.heartbeat}
          skills={state.skills}
          config={state.config}
          onRefreshAll={() => void state.refreshAll()}
          onCreateCron={(payload) => void state.createCron(payload)}
          onPatchCron={(id, payload) => void state.patchCron(id, payload)}
          onRunCron={(id) => void state.runCron(id)}
          onRemoveCron={(id) => void state.removeCron(id)}
          onSaveHeartbeat={(content) => void state.saveHeartbeat(content)}
          onTriggerHeartbeat={() => void state.triggerHeartbeat()}
          onSaveSkills={(settings) => void state.saveSkills(settings)}
          onSaveConfig={(nextConfig) => void state.saveConfig(nextConfig)}
        />
      </div>
    </div>
  );
}

export default App;
