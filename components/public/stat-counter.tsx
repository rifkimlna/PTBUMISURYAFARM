"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 1500) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min((t - t0) / duration, 1);
            setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { val, ref };
}

export function StatItem({
  target,
  suffix = "",
  prefix = "",
  label,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  label: string;
}) {
  const { val, ref } = useCountUp(target);
  return (
    <div className="text-center px-4 py-6 sm:py-8">
      <div className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 tabular-nums">
        <span ref={ref}>{prefix}{val.toLocaleString("id-ID")}</span>
        {suffix && <span className="text-green-700">{suffix}</span>}
      </div>
      <div className="mt-2 text-xs sm:text-sm font-medium text-slate-500">{label}</div>
    </div>
  );
}
