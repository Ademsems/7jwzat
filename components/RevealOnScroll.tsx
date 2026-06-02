"use client";

import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface Props {
  children: React.ReactNode;
  /** Delay before the reveal animation starts (ms). Use for staggering siblings. */
  delay?: number;
  /** Extra classes on the wrapper div (e.g. "h-full" to preserve grid height) */
  className?: string;
  threshold?: number;
}

export function RevealOnScroll({ children, delay = 0, className = "", threshold = 0.12 }: Props) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ threshold });

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isIntersecting ? 1 : 0,
        transform: isIntersecting ? "translateY(0px)" : "translateY(28px)",
        transition: `opacity 650ms ease-out ${delay}ms, transform 650ms ease-out ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
