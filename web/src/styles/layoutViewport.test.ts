import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutCss = readFileSync(resolve(process.cwd(), 'src/styles/layout.css'), 'utf8');

describe('layout viewport shell', () => {
  it('keeps app shell viewport-locked with bounded workspace', () => {
    expect(layoutCss).toContain('height: 100dvh;');
    expect(layoutCss).toContain('overflow: hidden;');
    expect(layoutCss).toContain('min-height: 0;');
    expect(layoutCss).toContain('.workspace-grid.desktop-utilities-mode');
  });
});
