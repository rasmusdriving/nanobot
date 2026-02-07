import type { CSSProperties, RefObject } from 'react';
import { useEffect, useMemo, useState } from 'react';

interface PopoverGeometry {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface ViewportBounds {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
}

const POPOVER_MAX_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 360;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;
const DEFAULT_PANEL_HEIGHT = 248;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getViewportBounds(): ViewportBounds {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
  }
  return {
    width: viewport.width,
    height: viewport.height,
    offsetLeft: viewport.offsetLeft,
    offsetTop: viewport.offsetTop,
  };
}

function measureGeometry(anchor: HTMLElement): PopoverGeometry {
  const viewport = getViewportBounds();
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(POPOVER_MAX_WIDTH, Math.max(220, viewport.width - VIEWPORT_MARGIN * 2));
  const maxHeight = Math.min(POPOVER_MAX_HEIGHT, viewport.height - VIEWPORT_MARGIN * 2);
  const minLeft = viewport.offsetLeft + VIEWPORT_MARGIN;
  const maxLeft = viewport.offsetLeft + viewport.width - width - VIEWPORT_MARGIN;
  const left = clamp(rect.right - width, minLeft, maxLeft);
  const belowEdge = viewport.offsetTop + viewport.height;
  const availableBelow = belowEdge - rect.bottom - VIEWPORT_MARGIN - ANCHOR_GAP;
  const availableAbove = rect.top - viewport.offsetTop - VIEWPORT_MARGIN - ANCHOR_GAP;
  const estimatedHeight = Math.min(maxHeight, DEFAULT_PANEL_HEIGHT);
  const preferAbove = availableBelow < estimatedHeight && availableAbove > availableBelow;
  const rawTop = preferAbove ? rect.top - estimatedHeight - ANCHOR_GAP : rect.bottom + ANCHOR_GAP;
  const minTop = viewport.offsetTop + VIEWPORT_MARGIN;
  const maxTop = Math.max(minTop, viewport.offsetTop + viewport.height - estimatedHeight - VIEWPORT_MARGIN);
  const top = clamp(rawTop, minTop, maxTop);
  return {
    top,
    left,
    width,
    maxHeight,
  };
}

function hiddenStyle(): CSSProperties {
  const viewport = getViewportBounds();
  return {
    position: 'fixed',
    left: viewport.offsetLeft + VIEWPORT_MARGIN,
    top: viewport.offsetTop + VIEWPORT_MARGIN,
    width: Math.min(POPOVER_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2),
    visibility: 'hidden',
  };
}

export function useAnchoredPopover<T extends HTMLElement>(anchorRef: RefObject<T>, open: boolean): CSSProperties {
  const [geometry, setGeometry] = useState<PopoverGeometry | null>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setGeometry(null);
      return;
    }

    const update = () => {
      if (!anchorRef.current) {
        return;
      }
      setGeometry(measureGeometry(anchorRef.current));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, open]);

  return useMemo(() => {
    if (!geometry) {
      return hiddenStyle();
    }
    return {
      position: 'fixed',
      top: geometry.top,
      left: geometry.left,
      width: geometry.width,
      maxHeight: geometry.maxHeight,
    };
  }, [geometry]);
}
