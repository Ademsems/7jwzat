"use client";

import { useEffect, useRef, useState } from "react";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface Props {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedCounter({
  target,
  duration = 1500,
  prefix = "",
  suffix = "",
  decimals = 0,
}: Props) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLSpanElement>({ threshold: 0.5 });
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!isIntersecting || started.current) return;
    started.current = true;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // cubic easeOut
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [isIntersecting, target, duration, decimals]);

  return (
    <span ref={ref}>
      {prefix}{decimals > 0 ? count.toFixed(decimals) : Math.round(count)}{suffix}
    </span>
  );
}
