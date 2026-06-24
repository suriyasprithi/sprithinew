"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
};

export function AnimatedCounter({ value, duration = 900, format, className }: Props) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = fromRef.current + (value - fromRef.current) * eased;
      // Round to whole numbers while counting for a smooth tick, but land on the
      // exact value at the end so decimal amounts (paise) are preserved.
      setDisplay(p < 1 ? Math.round(current) : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : display.toLocaleString("en-IN")}</span>;
}
