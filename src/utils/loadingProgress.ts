// Navigation-scoped loading progress — a pure state machine.
//
// The bar used to replay start→finish many times per navigation because it finished the
// instant the in-flight request count touched zero. Real pages load in waves (independent
// effects, awaited chains, data that only becomes fetchable once an earlier response lands),
// so the count dips to zero *between* waves and the old bar treated each dip as "done".
//
// Here a navigation opens one SESSION. Waves join the session; the session only ends once the
// app has been quiet for SETTLE_MS, which bridges those dips.
//
// Motion is anchored to real work: each completed request lands the bar on a milestone at
// `settled / started`. Between milestones it crawls asymptotically toward — but never onto — the
// next one, paced by the completion cadence this session has actually measured. So the bar is
// always moving (a slow request reads as a slow crawl, not a frozen bar), it slows down the
// longer something takes, and it can never claim work that has not finished.
//
// Time is passed in as data (`at`) rather than read from a clock, so every transition here is
// deterministic and unit-testable without fake timers or a DOM.

export interface LoadingStats {
  /** Requests currently outstanding. */
  inFlight: number;
  /** Monotonic count of requests ever started (never resets). */
  started: number;
  /** Monotonic count of requests ever settled (never resets). */
  settled: number;
}

export type LoadingEvent =
  | { type: 'navigate'; at: number }
  | { type: 'stats'; at: number; stats: LoadingStats }
  | { type: 'tick'; at: number };

export type LoadingPhase = 'idle' | 'armed' | 'running' | 'finishing';

export interface LoadingState {
  phase: LoadingPhase;
  /** 0-100, what the bar renders. Never decreases within a session. */
  width: number;
  visible: boolean;
  /** True while work is outstanding but no milestone has landed recently. */
  shimmer: boolean;
  openedAt: number;
  /** Cumulative counters at session open, so ratios are session-scoped. */
  baseline: LoadingStats;
  latest: LoadingStats;
  /** When the app last became quiet, or null while work is outstanding. */
  quietSince: number | null;
  /** When the current milestone band began — the clock the in-band crawl is measured against. */
  bandStartedAt: number;
  /** Learned completion cadence for this session, in ms. Paces the crawl so it feels right. */
  expectedMs: number;
  /** Set while the current band has outrun its expected pace — "slower than usual". */
  lastAdvanceAt: number;
  finishedAt: number;
}

/** Below this, an operation completes without ever showing a bar — no flash for fast work. */
export const REVEAL_DELAY_MS = 180;
/** Quiet time that ends a session. Must exceed the gap between a page's request waves. */
export const SETTLE_MS = 250;
/** Hold at 100% so the completion reads as deliberate rather than a glitch. */
export const COMPLETE_HOLD_MS = 180;
/**
 * Full-bar percentage a running session may reach. Deliberately short of 100 so that a nearly
 * finished bar still reads as "not done"; only the completion itself paints 100.
 */
export const CEILING = 92;
/** Assumed completion cadence before this session has measured one. */
export const DEFAULT_EXPECTED_MS = 450;
/** Weight of each new observation in the cadence estimate. */
export const EXPECTED_EMA = 0.4;
/** Clamp the estimate so one pathological request cannot wreck the pacing. */
export const EXPECTED_MIN_MS = 120;
export const EXPECTED_MAX_MS = 6000;
/** Past this fraction of a band the request has outrun its expected pace → shimmer. */
export const SLOW_SIGNAL = 0.85;
/**
 * Fraction of the REMAINING distance still left after each completion, used by the estimator
 * that assumes nothing about how much work is still to come.
 */
export const REMAIN_PER_COMPLETION = 0.5;
/** Backstop so a request that never settles cannot strand the bar. Exceeds the 15s axios timeout. */
export const MAX_SESSION_MS = 20000;

const ZERO: LoadingStats = { inFlight: 0, started: 0, settled: 0 };

function clampExpected(value: number): number {
  return Math.min(EXPECTED_MAX_MS, Math.max(EXPECTED_MIN_MS, value));
}

export const initialLoadingState: LoadingState = {
  phase: 'idle',
  width: 0,
  visible: false,
  shimmer: false,
  openedAt: 0,
  baseline: ZERO,
  latest: ZERO,
  quietSince: null,
  bandStartedAt: 0,
  expectedMs: DEFAULT_EXPECTED_MS,
  lastAdvanceAt: 0,
  finishedAt: 0,
};

/**
 * How far into the current milestone band the crawl has travelled, in [0, 1).
 *
 * `t/(1+t)` is strictly increasing and never reaches 1, so the bar always has
 * somewhere to go: fast while a request is behaving normally, ever slower the longer it takes,
 * but never stopping and never arriving. `expected` is this session's own measured completion
 * cadence, so the crawl is paced by how this app is actually responding right now rather than
 * by a hard-coded guess.
 */
export function bandFill(state: LoadingState, at: number): number {
  const elapsed = Math.max(0, at - state.bandStartedAt);
  const expected = Math.max(EXPECTED_MIN_MS, state.expectedMs);
  const ratio = elapsed / expected;

  // Hyperbolic rather than exponential decay. Both are strictly increasing and never reach 1,
  // but e^-t is visually saturated after ~3 time constants, which is exactly the frozen-bar
  // feeling this is meant to avoid. t/(1+t) keeps handing back perceptible movement for orders
  // of magnitude longer: ~71% of the band at 4x the expected wait, ~84% at 16x, ~87% at 32x.
  return ratio / (1 + ratio);
}

/**
 * Where the bar should sit right now.
 *
 * The band `[floor, next)` is bounded by real completions: `floor` is the fraction of this
 * session's requests that have finished, `next` is where the bar lands when the current one
 * does. Inside the band the crawl above supplies continuous motion. With nothing outstanding
 * there is nothing to crawl toward, so it rests on the honest floor.
 */
/**
 * Milestone position after `settled` completions out of `started` known requests.
 *
 * Two estimators, and we always trust the more conservative one:
 *
 * - `settled / started` is exact when the requests were issued together — ten in flight, four
 *   done really is 40%. It is badly wrong during a waterfall, where one-of-one done reads as
 *   100% while three more waves are still to come.
 * - `1 - remain^settled` assumes nothing about the total: every completion simply closes a fixed
 *   share of whatever distance is left. It is right in spirit for a waterfall and merely pessimistic
 *   for a parallel burst.
 *
 * Taking the minimum lets the ratio drive a parallel burst (where it is genuinely informative)
 * while the decay curve caps a waterfall (where the ratio would lie), with no need to guess the
 * total upfront — which is the actual situation.
 */
function milestone(settled: number, started: number): number {
  if (started <= 0 || settled <= 0) return 0;

  const ratio = Math.min(settled / started, 1);
  const decay = 1 - Math.pow(REMAIN_PER_COMPLETION, settled);

  return Math.min(ratio, decay);
}

/**
 * Where the bar should sit right now: the milestone earned by completed work, plus a crawl
 * toward — never onto — the milestone the outstanding request will earn. With nothing
 * outstanding there is nothing to crawl toward, so it rests on the earned milestone.
 */
export function targetWidth(state: LoadingState, at: number): number {
  const started = state.latest.started - state.baseline.started;
  const settled = state.latest.settled - state.baseline.settled;

  if (started <= 0) return 0;

  const floor = milestone(settled, started);

  if (state.latest.inFlight <= 0) return floor * CEILING;

  const next = milestone(settled + 1, Math.max(started, settled + 1));

  return (floor + (next - floor) * bandFill(state, at)) * CEILING;
}

function openSession(state: LoadingState, at: number, baseline: LoadingStats, latest: LoadingStats): LoadingState {
  return {
    ...state,
    phase: 'armed',
    openedAt: at,
    baseline,
    latest,
    quietSince: latest.inFlight > 0 ? null : at,
    bandStartedAt: at,
    lastAdvanceAt: at,
  };
}

/**
 * Re-baseline without hiding the bar. A second navigation while the first is still loading is a
 * real new navigation, but snapping the bar back to zero is exactly the restart this module
 * exists to remove — so the session continues from where it is and only its ratios reset.
 */
function rebaseline(state: LoadingState, at: number): LoadingState {
  return {
    ...state,
    openedAt: at,
    baseline: state.latest,
    quietSince: state.latest.inFlight > 0 ? null : at,
    bandStartedAt: at,
    lastAdvanceAt: at,
  };
}

function beginFinishing(state: LoadingState, at: number): LoadingState {
  return { ...state, phase: 'finishing', width: 100, visible: true, shimmer: false, finishedAt: at };
}

/** Resets the session but KEEPS the cumulative counters, which the next baseline is taken from. */
function closeSession(state: LoadingState): LoadingState {
  return { ...initialLoadingState, latest: state.latest };
}

function advance(state: LoadingState, at: number): LoadingState {
  const target = targetWidth(state, at);
  const width = Math.max(state.width, target);
  const moved = width > state.width + 0.01;

  return {
    ...state,
    width,
    lastAdvanceAt: moved ? at : state.lastAdvanceAt,
    // Not "has it stopped" — it never stops. This says the current request has already outrun
    // the pace this session established, which is the honest moment to signal "slower than usual".
    shimmer: state.latest.inFlight > 0 && bandFill(state, at) >= SLOW_SIGNAL,
  };
}

export function reduceLoading(state: LoadingState, event: LoadingEvent): LoadingState {
  if (event.type === 'navigate') {
    if (state.phase === 'idle') return openSession(state, event.at, state.latest, state.latest);
    if (state.phase === 'finishing') {
      return openSession({ ...state, width: 0, visible: false }, event.at, state.latest, state.latest);
    }

    return rebaseline(state, event.at);
  }

  if (event.type === 'stats') {
    const stats = event.stats;

    // A request that starts while idle opens its own session: <Routes> renders before this bar,
    // so a page's first wave is already in flight by the time the navigation is observed.
    if (state.phase === 'idle') {
      if (stats.started <= state.latest.started) return { ...state, latest: stats };

      return openSession(state, event.at, { ...stats, started: state.latest.started, settled: state.latest.settled }, stats);
    }

    const quietSince = stats.inFlight > 0 ? null : (state.quietSince ?? event.at);
    const completed = stats.settled > state.latest.settled;

    if (!completed) return { ...state, latest: stats, quietSince };

    // A completion closes the band. How long it took is the only pacing evidence available, so
    // feed it into the estimate and start the next band's clock from here.
    const observed = clampExpected(event.at - state.bandStartedAt);
    const expectedMs = clampExpected(state.expectedMs + (observed - state.expectedMs) * EXPECTED_EMA);

    return { ...state, latest: stats, quietSince, bandStartedAt: event.at, expectedMs };
  }

  const at = event.at;

  if (state.phase === 'idle') return state;

  if (state.phase === 'finishing') {
    if (at - state.finishedAt < COMPLETE_HOLD_MS) return state;

    return closeSession(state);
  }

  if (at - state.openedAt >= MAX_SESSION_MS) return beginFinishing(state, at);

  const quiet = state.quietSince != null && at - state.quietSince >= SETTLE_MS;

  if (state.phase === 'armed') {
    if (at - state.openedAt < REVEAL_DELAY_MS) return state;

    // Reveal only if work is genuinely outstanding at this instant. Everything that finished
    // inside the reveal delay never shows a bar at all.
    if (state.latest.inFlight > 0) return advance({ ...state, phase: 'running', visible: true }, at);

    return quiet ? closeSession(state) : state;
  }

  if (quiet) return beginFinishing(state, at);

  return advance(state, at);
}
