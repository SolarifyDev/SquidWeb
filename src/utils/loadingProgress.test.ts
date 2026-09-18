import { describe, it, expect } from 'vitest'
import {
  CEILING,
  COMPLETE_HOLD_MS,
  DEFAULT_EXPECTED_MS,
  MAX_SESSION_MS,
  REMAIN_PER_COMPLETION,
  REVEAL_DELAY_MS,
  SETTLE_MS,
  initialLoadingState,
  reduceLoading,
  targetWidth,
  type LoadingState,
  type LoadingStats,
} from './loadingProgress'

// The bug these pin: the bar replayed start→finish once per request wave, because it finished
// the moment the in-flight count touched zero. Real pages load in several waves, so a single
// navigation produced several full bars. Time is injected, so every case here is deterministic.

const stats = (inFlight: number, started: number, settled: number): LoadingStats => ({ inFlight, started, settled })

function feed(state: LoadingState, events: Array<Parameters<typeof reduceLoading>[1]>): LoadingState {
  return events.reduce(reduceLoading, state)
}

/** Advance the clock in tick-sized steps so timed transitions are actually exercised. */
function run(state: LoadingState, from: number, to: number, step = 16): LoadingState {
  let next = state
  let guard = 0

  for (let at = from; at <= to; at += step) {
    // A mutation that inflates a timing constant must surface as a failure, not as a suite that
    // hangs forever and hides every result behind it.
    if (++guard > 5000) throw new Error(`run() exceeded 5000 ticks between ${from} and ${to}`)
    next = reduceLoading(next, { type: 'tick', at })
  }

  return next
}

describe('one bar per navigation', () => {
  it('does not finish in the gap between two request waves', () => {
    // Wave 1 starts, completes; the counter sits at zero briefly; wave 2 starts. This is exactly
    // what /projects does with its four independent effects.
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 300)
    expect(s.phase).toBe('running')
    expect(s.visible).toBe(true)

    s = reduceLoading(s, { type: 'stats', at: 310, stats: stats(0, 1, 1) })
    s = run(s, 320, 420) // a 100ms gap — shorter than SETTLE_MS
    expect(s.phase).toBe('running')

    s = reduceLoading(s, { type: 'stats', at: 430, stats: stats(1, 2, 1) })
    s = run(s, 440, 600)

    expect(s.phase).toBe('running')
    expect(s.visible).toBe(true)
  })

  it('finishes once the app is genuinely quiet for SETTLE_MS', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 300)
    s = reduceLoading(s, { type: 'stats', at: 310, stats: stats(0, 1, 1) })
    s = run(s, 320, 310 + SETTLE_MS + 40)

    expect(s.phase).toBe('finishing')
    expect(s.width).toBe(100)
  })

  it('hides and resets after the completion hold', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 300)
    s = reduceLoading(s, { type: 'stats', at: 310, stats: stats(0, 1, 1) })
    s = run(s, 320, 310 + SETTLE_MS + COMPLETE_HOLD_MS + 80)

    expect(s.phase).toBe('idle')
    expect(s.visible).toBe(false)
    expect(s.width).toBe(0)
  })

  it('counts one reveal across a four-wave page load', () => {
    // Count how many times the bar transitions hidden → visible. Must be exactly one.
    let s = initialLoadingState
    let reveals = 0
    const step = (event: Parameters<typeof reduceLoading>[1]) => {
      const before = s.visible
      s = reduceLoading(s, event)
      if (!before && s.visible) reveals += 1
    }

    step({ type: 'navigate', at: 0 })
    let started = 0
    let settled = 0
    let at = 10

    for (let wave = 0; wave < 4; wave += 1) {
      started += 1
      step({ type: 'stats', at, stats: stats(1, started, settled) })
      for (let t = at; t <= at + 200; t += 16) step({ type: 'tick', at: t })
      at += 210
      settled += 1
      step({ type: 'stats', at, stats: stats(0, started, settled) })
      for (let t = at; t <= at + 120; t += 16) step({ type: 'tick', at: t }) // gap < SETTLE_MS
      at += 130
    }

    expect(reveals).toBe(1)
  })
})

describe('progress reflects real completions', () => {
  const sessionAt = (inFlight: number, started: number, settled: number, bandStartedAt = 0): LoadingState => ({
    ...initialLoadingState,
    baseline: stats(0, 0, 0),
    latest: stats(inFlight, started, settled),
    bandStartedAt,
    expectedMs: DEFAULT_EXPECTED_MS,
  })

  it('uses the exact ratio for a parallel burst, where it is genuinely informative', () => {
    // Ten issued together, four done really is 40% — the decay estimator must not cap this.
    const s = sessionAt(6, 10, 4)

    expect(targetWidth(s, 0)).toBeCloseTo(0.4 * CEILING, 5)
  })

  it('caps a waterfall, where the ratio would claim one-of-one done means finished', () => {
    // One request issued, one settled, nothing outstanding. The ratio says 100%; three more
    // waves may still be coming, so the conservative estimator must win.
    const s = sessionAt(0, 1, 1)

    expect(targetWidth(s, 0)).toBeCloseTo((1 - REMAIN_PER_COMPLETION) * CEILING, 5)
    expect(targetWidth(s, 0)).toBeLessThan(CEILING)
  })

  it('never reaches the milestone the outstanding request would earn', () => {
    const s = sessionAt(1, 1, 0)
    const nextMilestone = (1 - REMAIN_PER_COMPLETION) * CEILING

    // Even after an absurdly long wait the crawl stays strictly short of it.
    expect(targetWidth(s, 10 * 60 * 1000)).toBeLessThan(nextMilestone)
  })

  it('leaves visible headroom while running, so a nearly-full bar never reads as finished', () => {
    // Pinned literal: raising this toward 100 makes a still-loading page look complete.
    expect(CEILING).toBeLessThanOrEqual(95)

    // Ten of ten settled but the session has not been quiet long enough to finish.
    const s = sessionAt(0, 10, 10)

    expect(targetWidth(s, 0)).toBeLessThanOrEqual(CEILING)
    expect(targetWidth(s, 0)).toBeLessThan(100)
  })

  it('is session-scoped: a previous navigation\u2019s requests do not count', () => {
    const s: LoadingState = {
      ...initialLoadingState,
      baseline: stats(0, 100, 100),
      latest: stats(0, 102, 101),
    }

    // 1 of 2 settled this session, not 101 of 102.
    expect(targetWidth(s, 0)).toBeCloseTo(Math.min(1 / 2, 1 - REMAIN_PER_COMPLETION) * CEILING, 5)
  })

  it('never moves backward when a new wave lowers the ratio', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 400)
    s = reduceLoading(s, { type: 'stats', at: 410, stats: stats(0, 1, 1) })
    s = run(s, 420, 500)

    const peak = s.width
    expect(peak).toBeGreaterThan(0)

    s = reduceLoading(s, { type: 'stats', at: 510, stats: stats(3, 4, 1) })
    s = run(s, 520, 900)

    expect(s.width).toBeGreaterThanOrEqual(peak)
  })

  it('jumps forward when a request actually settles', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(4, 4, 0) },
    ])
    s = run(s, 20, 600)
    const beforeSettle = s.width

    s = reduceLoading(s, { type: 'stats', at: 610, stats: stats(2, 4, 2) })
    s = run(s, 620, 700)

    expect(s.width).toBeGreaterThan(beforeSettle)
  })
})

describe('the bar never stops moving while work is outstanding', () => {
  it('keeps advancing for as long as a slow request runs', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 500)

    // Sample across a 16 second wait; every sample must be strictly ahead of the last.
    let previous = s.width
    for (const at of [1000, 2000, 4000, 8000, 16000]) {
      s = run(s, previous === s.width ? at - 400 : at - 400, at)
      expect(s.width).toBeGreaterThan(previous)
      previous = s.width
    }
  })

  it('still advances perceptibly deep into a long wait', () => {
    // The point of the whole pacing curve. An exponential crawl is visually frozen after a few
    // time constants; between 8s and 16s it would gain ~0%. Anything the user is meant to read
    // as "still working" has to keep producing movement they can actually see.
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])

    s = run(s, 20, 8000, 64)
    const atEightSeconds = s.width

    s = run(s, 8064, 16000, 64)

    expect(s.width - atEightSeconds).toBeGreaterThan(0.5)
  })

  it('decelerates — later intervals advance less than earlier ones', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])

    s = run(s, 20, 1000)
    const atOneSecond = s.width
    s = run(s, 1016, 2000)
    const earlyGain = s.width - atOneSecond

    const atTwoSeconds = s.width
    s = run(s, 2016, 3000)
    const lateGain = s.width - atTwoSeconds

    expect(earlyGain).toBeGreaterThan(0)
    expect(lateGain).toBeGreaterThan(0)
    expect(lateGain).toBeLessThan(earlyGain)
  })

  it('paces the crawl from the cadence this session measured, not a fixed guess', () => {
    // A session whose requests have been settling slowly should crawl more slowly than one
    // whose requests are quick, at the same elapsed time into a band.
    const quick: LoadingState = { ...initialLoadingState, baseline: stats(0, 0, 0), latest: stats(1, 2, 1), bandStartedAt: 0, expectedMs: 150 }
    const slow: LoadingState = { ...quick, expectedMs: 3000 }

    expect(targetWidth(quick, 600)).toBeGreaterThan(targetWidth(slow, 600))
  })

  it('learns a slower cadence from a slow first request', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 0, stats: stats(2, 2, 0) },
    ])
    const before = s.expectedMs

    s = reduceLoading(s, { type: 'stats', at: 2500, stats: stats(1, 2, 1) })

    expect(s.expectedMs).toBeGreaterThan(before)
  })

  it('holds rather than crawling when nothing is outstanding', () => {
    // Inside a waterfall gap there is no request to crawl toward; inventing motion there would
    // be the timer fiction this replaced.
    const s: LoadingState = { ...initialLoadingState, baseline: stats(0, 0, 0), latest: stats(0, 2, 1), bandStartedAt: 0 }

    expect(targetWidth(s, 100)).toBe(targetWidth(s, 9000))
  })

  it('signals "slower than usual" once a request outruns the measured pace', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 600)
    expect(s.shimmer).toBe(false)

    s = run(s, 616, 8000, 64)
    expect(s.shimmer).toBe(true)
  })
})

describe('consecutive navigations', () => {
  it('a second navigation does not inherit the first one\u2019s completed requests', () => {
    // request.ts counters are cumulative and never reset. A session that re-baselined from zero
    // would compute settled/started over the app\u2019s entire history and open near 100%.
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 300)
    s = reduceLoading(s, { type: 'stats', at: 310, stats: stats(0, 1, 1) })
    s = run(s, 320, 310 + SETTLE_MS + COMPLETE_HOLD_MS + 120)
    expect(s.phase).toBe('idle')

    // Many more requests happen (polling, other pages) before the next navigation.
    s = reduceLoading(s, { type: 'stats', at: 5000, stats: stats(0, 47, 47) })

    s = reduceLoading(s, { type: 'navigate', at: 6000 })
    s = reduceLoading(s, { type: 'stats', at: 6010, stats: stats(1, 48, 47) })
    s = run(s, 6020, 6100)

    // One request outstanding, none settled this session \u2014 must be near the start, not 98%.
    expect(s.baseline.started).toBe(47)

    // With a polluted baseline this would be milestone(47, 48) \u2248 98% of CEILING. Session-scoped
    // it is one outstanding request and nothing settled, so it must still be short of the first
    // milestone the crawl is heading for.
    expect(targetWidth(s, 6100)).toBeLessThan((1 - REMAIN_PER_COMPLETION) * CEILING)
    expect(s.width).toBeLessThan((1 - REMAIN_PER_COMPLETION) * CEILING)
  })

  it('carries the cumulative counters across a closed session', () => {
    let s = feed(initialLoadingState, [
      { type: 'stats', at: 0, stats: stats(1, 1, 0) },
      { type: 'stats', at: 50, stats: stats(0, 1, 1) },
    ])
    s = run(s, 60, 60 + REVEAL_DELAY_MS + SETTLE_MS + 100)
    expect(s.phase).toBe('idle')
    expect(s.latest.started).toBe(1)
  })
})

describe('no flash for fast or background work', () => {
  it('never reveals for a request that settles inside the reveal delay', () => {
    let s = feed(initialLoadingState, [
      { type: 'stats', at: 0, stats: stats(1, 1, 0) },
      { type: 'stats', at: REVEAL_DELAY_MS - 60, stats: stats(0, 1, 1) },
    ])
    s = run(s, 0, REVEAL_DELAY_MS + SETTLE_MS + 100)

    expect(s.visible).toBe(false)
    expect(s.phase).toBe('idle')
  })

  it('never reveals for a navigation that issues no requests at all', () => {
    let s = reduceLoading(initialLoadingState, { type: 'navigate', at: 0 })
    s = run(s, 0, REVEAL_DELAY_MS + SETTLE_MS + 200)

    expect(s.visible).toBe(false)
    expect(s.phase).toBe('idle')
  })

  it('does reveal when work is still outstanding at the reveal deadline', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 5, stats: stats(1, 1, 0) },
    ])
    s = run(s, 10, REVEAL_DELAY_MS + 60)

    expect(s.visible).toBe(true)
    expect(s.phase).toBe('running')
  })
})

describe('robustness', () => {
  it('opens a session when a request beats the navigation event', () => {
    // <Routes> renders before the bar, so a page's first wave is already in flight by the time
    // the navigation is observed. Without this the first wave would show nothing.
    let s = reduceLoading(initialLoadingState, { type: 'stats', at: 0, stats: stats(1, 1, 0) })
    expect(s.phase).toBe('armed')

    s = run(s, 10, REVEAL_DELAY_MS + 60)
    expect(s.visible).toBe(true)
  })

  it('force-finishes a request that never settles', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, MAX_SESSION_MS + 200, 200)

    expect(s.phase === 'finishing' || s.phase === 'idle').toBe(true)
    expect(s.width === 100 || s.width === 0).toBe(true)
  })

  it('keeps one continuous bar when the user navigates again mid-load', () => {
    let s = feed(initialLoadingState, [
      { type: 'navigate', at: 0 },
      { type: 'stats', at: 10, stats: stats(1, 1, 0) },
    ])
    s = run(s, 20, 500)
    const before = s.width
    expect(s.visible).toBe(true)

    s = reduceLoading(s, { type: 'navigate', at: 510 })

    // Re-baselined for the new page, but not snapped back to zero — that snap is the restart
    // this whole module exists to remove.
    expect(s.visible).toBe(true)
    expect(s.width).toBe(before)
    expect(s.baseline.started).toBe(1)
  })
})
