import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPopover } from './useAnchoredPopover';

interface TokenPopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  tokenDraft: string;
  onTokenDraftChange: (value: string) => void;
  onApply: () => void;
  onReload: () => void;
  onClose: () => void;
}

function shouldCloseFromPointer(
  target: EventTarget | null,
  panelRef: RefObject<HTMLDivElement>,
  anchorRef: RefObject<HTMLButtonElement>,
): boolean {
  if (!(target instanceof Node)) {
    return false;
  }
  if (panelRef.current?.contains(target)) {
    return false;
  }
  if (anchorRef.current?.contains(target)) {
    return false;
  }
  return true;
}

export function TokenPopover(props: TokenPopoverProps) {
  const { open, anchorRef, tokenDraft, onTokenDraftChange, onApply, onReload, onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const popoverStyle = useAnchoredPopover(anchorRef, open);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open && wasOpenRef.current) {
      anchorRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      if (shouldCloseFromPointer(event.target, panelRef, anchorRef)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="token-popover-shell" style={popoverStyle}>
      <div ref={panelRef} id="token-popover" className="token-popover" role="dialog" aria-label="Token settings" aria-modal="false">
        <label className="field">
          API token
          <input
            ref={inputRef}
            type="password"
            value={tokenDraft}
            onChange={(event) => onTokenDraftChange(event.target.value)}
            placeholder="Optional bearer token"
          />
        </label>
        <div className="inline-actions">
          <button className="glass-btn" onClick={onApply}>
            Apply
          </button>
          <button className="ghost-btn" onClick={onReload}>
            Reload
          </button>
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
