/**
 * Real User Monitoring (RUM) for EduTrack.
 *
 * Captures Core Web Vitals (LCP, INP, CLS), Time to First Byte, and client-side
 * route-change latency, then aggregates them into daily rollups persisted to
 * localStorage using the shapes defined in perf-metrics.ts.
 *
 * Importing this module starts observation automatically in the browser. It is
 * safe to import during server rendering: nothing touches the DOM unless
 * `window` and `PerformanceObserver` are available.
 */

import type { DailyRollup, LatencySummary } from "./perf-metrics";
import {
  addLatencySample,
  dayKey,
  emptyRollup,
  mergeLatency,
  mergeRollup,
  parseHistory,
} from "./perf-metrics";

const STORAGE_KEY = "edutrack:perf:daily";
const FLUSH_INTERVAL_MS = 15_000;
const MAX_HISTORY_DAYS = 30;

type LatencyField =
  | "queryLatency"
  | "apiLatency"
  | "lcpLatency"
  | "inpLatency"
  | "clsLatency"
  | "ttfbLatency"
  | "routeLatency";

let initialized = false;
let current: DailyRollup | null = null;
let sessionStart = 0;
let lastTick = 0;
let visibleTime = 0;
let lastVisibleAt = 0;
let routeStart = 0;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function loadHistory(): DailyRollup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseHistory(raw) ?? [];
  } catch {
    return [];
  }
}

function saveHistory(history: DailyRollup[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY_DAYS)),
    );
  } catch {
    // Quota exceeded / private mode � non fatal.
  }
}

/** Returns (and lazily creates) the rollup for today, kept in memory. */
function today(): DailyRollup {
  const key = dayKey(new Date());
  if (current && current.date === key) return current;
  const history = loadHistory();
  const found = history.find((r) => r.date === key);
  current = found ?? emptyRollup(key);
  if (found == null) current.sessions += 1;
  return current;
}

function record(field: LatencyField, ms: number): void {
  const rollup = today();
  const prev = rollup[field];
  rollup[field] = addLatencySample(prev, ms);
}

/** Flush the in-memory rollup into localStorage history. */
function flush(): void {
  if (!current) return;
  const rollup = current;
  current = null;
  const history = loadHistory();
  const idx = history.findIndex((r) => r.date === rollup.date);
  if (idx >= 0) history[idx] = mergeRollup(history[idx], rollup);
  else history.push(rollup);
  history.sort((a, b) => (a.date < b.date ? 1 : b.date > a.date ? -1 : 0));
  saveHistory(history);
}

function scheduleFlush(): void {
  if (typeof window === "undefined" || typeof setTimeout === "undefined") return;
  setTimeout(() => {
    flush();
    scheduleFlush();
  }, FLUSH_INTERVAL_MS);
}

/** Accumulate time-the-tab-was-visible on visibility changes. */
function trackVisibility(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const handle = () => {
    const t = now();
    if (document.visibilityState === "visible") {
      lastVisibleAt = t;
    } else if (lastVisibleAt > 0) {
      visibleTime += t - lastVisibleAt;
      lastVisibleAt = 0;
    }
    flush();
  };
  window.addEventListener("visibilitychange", handle, { passive: true });
  // Account for any visible time already elapsed before this script ran.
  if (document.visibilityState === "visible") lastVisibleAt = now();
}

function observeLCP(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint") {
          record("lcpLatency", entry.startTime);
        }
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // LCP not supported � non fatal.
  }
}

function observeINP(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "event" && typeof (entry as any).duration === "number") {
          record("inpLatency", (entry as any).duration);
        }
      }
    });
    po.observe({ type: "event", buffered: true });
  } catch {
    // INP not supported � non fatal.
  }
}

function observeCLS(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "layout-shift" && !(entry as any).hadRecentInput) {
          record("clsLatency", Number((entry as any).value) * 1000);
        }
      }
    });
    po.observe({ type: "layout-shift", buffered: true });
  } catch {
    // CLS not supported � non fatal.
  }
}

function observeTTFB(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const nav = entry as PerformanceNavigationTiming;
          const ttfb =
            nav.responseStart - (nav.requestStart ?? nav.fetchStart ?? 0);
          if (Number.isFinite(ttfb) && ttfb >= 0) record("ttfbLatency", ttfb);
        }
      }
    });
    po.observe({ type: "navigation", buffered: true });
  } catch {
    // TTFB not supported � non fatal.
  }
}

/**
 * Call this from a router subscription: marks the moment a route transition
 * begins so its total duration can be recorded when it settles.
 */
export function markRouteStart(): void {
  routeStart = now();
}

/** Records the elapsed time since the most recent `markRouteStart()`. */
export function markRouteEnd(): void {
  if (routeStart <= 0) return;
  record("routeLatency", now() - routeStart);
  routeStart = 0;
}

/** Returns the in-memory rollup for today (mainly for testing/debugging). */
export function currentRollup(): DailyRollup | null {
  return current ?? today();
}

/** Force a flush to localStorage. */
export function flushPerf(): void {
  flush();
}

/** One-time initialization: start all observers and periodic flush. */
function initPerfMonitor(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  sessionStart = now();
  lastTick = now();
  observeLCP();
  observeINP();
  observeCLS();
  observeTTFB();
  trackVisibility();
  scheduleFlush();
  // Flush before the tab goes away so the session is persisted.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flush, { passive: true });
    window.addEventListener("beforeunload", flush, { passive: true });
  }
}

// Start observing automatically when this module is imported in the browser.
initPerfMonitor();
