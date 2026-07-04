// Shared motion tokens — keep easing/variants consistent across the app.
import type { Variants } from "framer-motion";

export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOutExpo } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
