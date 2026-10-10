import { MOTION } from "../data/motion";
import type { Motion, MotionLevel, Ride } from "../types";

export const MOTION_LABEL: Record<MotionLevel, string> = { 0: "なし", 1: "低", 2: "中", 3: "高", 4: "最高" };

const FALLBACK: Motion = { level: 0, source: "estimate" };

export const motionOf = (ride: Ride): Motion => MOTION[ride.id] ?? FALLBACK;

/** ●●●○ のような4段の表示（0は全部○） */
export const motionDots = (level: MotionLevel): string => "●".repeat(level) + "○".repeat(4 - level);
