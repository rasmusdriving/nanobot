import { useEffect, useRef } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TokenPopover } from './TokenPopover';

interface HarnessProps {
  open?: boolean;
  onClose?: () => void;
}

function Harness({ open = true, onClose = vi.fn() }: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!anchorRef.current) {
      return;
    }
    anchorRef.current.getBoundingClientRect = () => ({
      x: 900,
      y: 20,
      width: 56,
      height: 34,
      top: 20,
      right: 956,
      bottom: 54,
      left: 900,
      toJSON: () => ({}),
    });
  }, []);

  return (
    <div>
      <button ref={anchorRef}>Token</button>
      <TokenPopover
        open={open}
        anchorRef={anchorRef}
        tokenDraft="secret"
        onTokenDraftChange={vi.fn()}
        onApply={vi.fn()}
        onReload={vi.fn()}
        onClose={onClose}
      />
    </div>
  );
}

describe('TokenPopover', () => {
  it('renders as a portal on document.body', () => {
    render(<Harness />);

    const dialog = screen.getByRole('dialog', { name: 'Token settings' });
    const shell = dialog.closest('.token-popover-shell');
    expect(shell).toBeInTheDocument();
    expect(document.body.contains(shell)).toBe(true);
  });

  it('closes on escape and outside click', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('restores focus to the anchor button when closing', () => {
    const view = render(<Harness open />);
    const anchor = screen.getByRole('button', { name: 'Token' });
    view.rerender(<Harness open={false} />);
    expect(anchor).toHaveFocus();
  });
});
