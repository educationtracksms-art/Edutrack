/**
 * Pure, dependency-free helpers for the post-deployment performance monitor.
 *
 * Everything here is intentionally testable without a DOM: the browser wiring
 * lives in `perf-monitor.ts`, which only composes these primitives.
 */

/** Upper bounds (ms) for the latency histogram. One extra bucket holds values above the last bound. */
export const LATENCY_BUCKET_BOUNDS_MS = [25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

/**
 * A mergeable latency summary. Raw samples are never retained (localStorage
 * friendly): percentiles are estimated from fixed buckets while the average
 * stays exact via count/sum.
 */
export type LatencySummary = {
  count: number;
  sumMs: number;
  maxMs: number;
  /** One counter per bucket: LATENCY_BUCKET_BOUNDS_MS.length + 1 (overflow). */
  buckets: number[];
};

export type DailyRollup = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  sessions: number;
  /** Wall-clock session time across all sessions that day (ms). */
  sessionMs: number;
  /** Time the tab was visible across all sessions that day (ms). */
  activeMs: number;
  /** React Query network fetches (cache-served reads are not counted). */
  networkQueries: number;
  queryErrors: number;
  /** Raw API calls observed via the Resource Timing API. */
  apiCalls: number;
  queryLatency: LatencySummary;
  apiLatency: LatencySummary;
};

export function emptyLatency(): LatencySummary {
  return {
    count: 0,
    sumMs: 0,
    maxMs: 0,
    buckets: new Array<number>(LATENCY_BUCKET_BOUNDS_MS.length + 1).fill(0),
  };
}

function bucketIndex(ms: number): number {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  for (let i = 0; i < LATENCY_BUCKET_BOUNDS_MS.length; i += 1) {
    if (safe <= LATENCY_BUCKET_BOUNDS_MS[i]) return i;
  }
  return LATENCY_BUCKET_BOUNDS_MS.length;
}

/** Returns a new summary with `ms` recorded (inputs are never mutated). */
export function addLatencySample(summary: LatencySummary, ms: number): LatencySummary {
  const buckets = [...summary.buckets];
  const index = bucketIndex(ms);
  buckets[index] = (buckets[index] ?? 0) + 1;
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return {
    count: summary.count + 1,
    sumMs: summary.sumMs + safe,
    maxMs: Math.max(summary.maxMs, safe),
    buckets,
  };
}

export function emptyRollup(date: string): DailyRollup {
  return {
    date,
    sessions: 0,
    sessionMs: 0,
    activeMs: 0,
    networkQueries: 0,
    queryErrors: 0,
    apiCalls: 0,
    queryLatency: emptyLatency(),
    apiLatency: emptyLatency(),
  };
}

/** Adds `incoming` on top of an existing rollup for the same day. */
export function mergeRollup(base: DailyRollup, incoming: DailyRollup): DailyRollup {
  return {
    date: base.date,
    sessions: base.sessions + incoming.sessions,
    sessionMs: base.sessionMs + incoming.sessionMs,
    activeMs: base.activeMs + incoming.activeMs,
    networkQueries: base.networkQueries + incoming.networkQueries,
    queryErrors: base.queryErrors + incoming.queryErrors,
    apiCalls: base.apiCalls + incoming.apiCalls,
    queryLatency: mergeLatency(base.queryLatency, incoming.queryLatency),
    apiLatency: mergeLatency(base.apiLatency, incoming.apiLatency),
  };
}

/**
 * Upserts `incoming` into `history` (same-day entries merge), keeps the list
 * sorted newest-first and caps it at `maxDays` entries.
 */
export function mergeHistory(
  history: readonly DailyRollup[],
  incoming: DailyRollup,
  maxDays = 30,
): DailyRollup[] {
  const others = history.filter((rollup) => rollup.date !== incoming.date);
  const merged = others.reduce((rollup, entry) => mergeRollup(entry, rollup), incoming);
  return [...others, merged]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, maxDays);
}

/** Network queries per minute of session time — comparable across session lengths. */
export function queriesPerMinute(rollup: DailyRollup): number {
  const minutes = rollup.sessionMs / 60_000;
  return minutes > 0 ? rollup.networkQueries / minutes : 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLatencySummary(value: unknown): value is LatencySummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as LatencySummary;
  return (
    isFiniteNumber(summary.count) &&
    isFiniteNumber(summary.sumMs) &&
    isFiniteNumber(summary.maxMs) &&
    Array.isArray(summary.buckets) &&
    summary.buckets.length === LATENCY_BUCKET_BOUNDS_MS.length + 1 &&
    summary.buckets.every((bucket) => isFiniteNumber(bucket))
  );
}

export function isDailyRollup(value: unknown): value is DailyRollup {
  if (!value || typeof value !== "object") return false;
  const rollup = value as DailyRollup;
  return (
    typeof rollup.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(rollup.date) &&
    isFiniteNumber(rollup.sessions) &&
    isFiniteNumber(rollup.sessionMs) &&
    isFiniteNumber(rollup.activeMs) &&
    isFiniteNumber(rollup.networkQueries) &&
    isFiniteNumber(rollup.queryErrors) &&
    isFiniteNumber(rollup.apiCalls) &&
    isLatencySummary(rollup.queryLatency) &&
    isLatencySummary(rollup.apiLatency)
  );
}

/** Parses the persisted daily rollup history; returns null for anything malformed. */
export function parseHistory(raw: string | null | undefined): DailyRollup[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isDailyRollup);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

/** Combines two summaries (used to merge session stats into a daily rollup). */
export function mergeLatency(a: LatencySummary, b: LatencySummary): LatencySummary {
  const buckets = a.buckets.map((value, index) => value + (b.buckets[index] ?? 0));
  return {
    count: a.count + b.count,
    sumMs: a.sumMs + b.sumMs,
    maxMs: Math.max(a.maxMs, b.maxMs),
    buckets,
  };
}

/** Exact mean latency in ms (0 when no samples). */
export function avgLatency(summary: LatencySummary): number {
  return summary.count > 0 ? summary.sumMs / summary.count : 0;
}

/**
 * Estimated percentile in ms. Bucketed summaries return the bucket's upper
 * bound (the overflow bucket reports the observed max instead).
 */
export function percentileLatency(summary: LatencySummary, percentile: number): number {
  if (summary.count <= 0) return 0;
  const target = Math.max(1, Math.ceil((percentile / 100) * summary.count));
  let seen = 0;
  for (let i = 0; i < summary.buckets.length; i += 1) {
    seen += summary.buckets[i] ?? 0;
    if (seen >= target) {
      return i < LATENCY_BUCKET_BOUNDS_MS.length ? LATENCY_BUCKET_BOUNDS_MS[i] : summary.maxMs;
    }
  }
  return summary.maxMs;
}

/**
 * Percentage reduction of `current` relative to `baseline`.
 * Returns null when the baseline is missing/zero so callers can show "no baseline".
 * A negative number means the metric went up.
 */
export function percentReduction(baseline: number, current: number): number | null {
  if (!Number.isFinite(baseline) || !Number.isFinite(current) || baseline <= 0) return null;
  return Math.round(((baseline - current) / baseline) * 1000) / 10;
}

/** Local calendar day key (YYYY-MM-DD) used to bucket rollups. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
