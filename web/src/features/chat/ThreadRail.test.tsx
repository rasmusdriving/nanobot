import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThreadRail } from './ThreadRail';

describe('ThreadRail', () => {
  it('keeps draft thread visible without showing empty-state copy', () => {
    render(
      <ThreadRail
        sessions={[]}
        activeSessionKey="web:draft"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
        onCreateThread={vi.fn()}
        open
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('web:draft')).toBeInTheDocument();
    expect(screen.queryByText('No sessions match your search.')).not.toBeInTheDocument();
  });

  it('shows empty-state copy when no sessions match search', () => {
    render(
      <ThreadRail
        sessions={[{ key: 'web:control-room', created_at: '', updated_at: '' }]}
        activeSessionKey="web:control-room"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
        onCreateThread={vi.fn()}
        open
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Find session key'), { target: { value: 'missing' } });
    expect(screen.getByText('No sessions match your search.')).toBeInTheDocument();
  });
});
