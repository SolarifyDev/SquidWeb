import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeInFlight } from 'utils/request';

// GitHub / NProgress 风格的细进度条，钉在内容方框（page-content-right）顶边。
// 触发源：路由切换 + axios 进行中的请求数（两者任一活跃即显示）。
const TopProgressBar: React.FC = () => {
  const location = useLocation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  const phaseRef = useRef<'idle' | 'run' | 'done'>('idle');
  const trickleRef = useRef<number>();
  const doneRef = useRef<number>();
  const navTimerRef = useRef<number>();
  const inFlightRef = useRef(0);

  const begin = useCallback(() => {
    if (phaseRef.current === 'run') return;

    phaseRef.current = 'run';
    window.clearTimeout(doneRef.current);
    setVisible(true);
    setWidth(8);

    window.clearInterval(trickleRef.current);
    trickleRef.current = window.setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 280);
  }, []);

  const finish = useCallback(() => {
    if (phaseRef.current !== 'run') return;

    phaseRef.current = 'done';
    window.clearInterval(trickleRef.current);
    setWidth(100);

    doneRef.current = window.setTimeout(() => {
      setVisible(false);
      phaseRef.current = 'idle';
      window.setTimeout(() => setWidth(0), 220);
    }, 260);
  }, []);

  useEffect(() => {
    return subscribeInFlight((count) => {
      inFlightRef.current = count;
      if (count > 0) begin();
      else finish();
    });
  }, [begin, finish]);

  useEffect(() => {
    begin();
    window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => {
      if (inFlightRef.current === 0) finish();
    }, 450);
    return () => window.clearTimeout(navTimerRef.current);
  }, [location.key, begin, finish]);

  useEffect(() => {
    return () => {
      window.clearInterval(trickleRef.current);
      window.clearTimeout(doneRef.current);
      window.clearTimeout(navTimerRef.current);
    };
  }, []);

  return (
    <div className="relative z-50 h-[2px] flex-none pointer-events-none">
      <div
        className="absolute inset-y-0 left-0 bg-squid-blue rounded-r-full"
        style={{
          width: `${width}%`,
          opacity: visible ? 1 : 0,
          transition: 'width 0.2s ease-out, opacity 0.25s ease-out',
        }}
      />
    </div>
  );
};

export default TopProgressBar;
