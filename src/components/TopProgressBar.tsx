import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeInFlight } from 'utils/request';
import {
  initialLoadingState,
  reduceLoading,
  type LoadingState,
} from 'utils/loadingProgress';

// Thin adapter over the pure state machine in utils/loadingProgress: it owns no logic beyond
// feeding the reducer three event sources — navigation, request telemetry, and an animation
// frame — and rendering whatever state comes back.
const TopProgressBar: React.FC = () => {
  const location = useLocation();
  const stateRef = useRef<LoadingState>(initialLoadingState);
  const [view, setView] = useState({ width: 0, visible: false, shimmer: false });
  const frameRef = useRef<number>();

  // One ref-held dispatch so the effects below never need to re-subscribe when state changes.
  const dispatchRef = useRef<(event: Parameters<typeof reduceLoading>[1]) => void>();

  if (!dispatchRef.current) {
    const pump = () => {
      dispatchRef.current?.({ type: 'tick', at: performance.now() });

      // Stop scheduling once the machine is back at rest; the next navigation or request
      // restarts the loop. An idle app therefore costs nothing.
      if (stateRef.current.phase === 'idle') {
        frameRef.current = undefined;
        return;
      }

      frameRef.current = window.requestAnimationFrame(pump);
    };

    dispatchRef.current = (event) => {
      const next = reduceLoading(stateRef.current, event);

      if (next !== stateRef.current) {
        stateRef.current = next;
        setView((prev) =>
          prev.width === next.width && prev.visible === next.visible && prev.shimmer === next.shimmer
            ? prev
            : { width: next.width, visible: next.visible, shimmer: next.shimmer },
        );
      }

      if (stateRef.current.phase !== 'idle' && frameRef.current == null) {
        frameRef.current = window.requestAnimationFrame(pump);
      }
    };
  }

  useEffect(() => {
    return subscribeInFlight((stats) => {
      dispatchRef.current?.({ type: 'stats', at: performance.now(), stats });
    });
  }, []);

  useEffect(() => {
    dispatchRef.current?.({ type: 'navigate', at: performance.now() });
  }, [location.key]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="relative z-50 h-[2px] flex-none pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-y-0 left-0 overflow-hidden bg-squid-blue rounded-r-full"
        style={{
          width: `${view.width}%`,
          opacity: view.visible ? 1 : 0,
          transition: 'width 0.18s ease-out, opacity 0.25s ease-out',
        }}
      >
        {view.shimmer && (
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        )}
      </div>
    </div>
  );
};

export default TopProgressBar;
