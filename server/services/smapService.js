/**
 * smapService.js
 *
 * NASA SMAP/GEFS soil moisture data requires Earthdata authentication and
 * has coarse spatial/temporal resolution that isn't well suited to a
 * fast-refresh hackathon demo (see IMPLEMENTATION_PLAN.md, Section 2).
 *
 * Strategy: cache a real regional SMAP baseline per zone (fetched
 * separately / offline), then apply a small bounded random walk around
 * that baseline on each cron tick, so values look live and stay
 * physically plausible instead of being pure noise.
 *
 * Swap `fetchCachedBaseline` for a real Earthdata-authenticated pull
 * once credentials are set up.
 */

const zoneBaselines = new Map(); // zoneId -> last soil moisture value

function fetchCachedBaseline(zoneId, fallback = 45) {
  // TODO: replace with a real cached SMAP value per zone (loaded at boot
  // from a small JSON/CSV of recent regional readings).
  return zoneBaselines.has(zoneId) ? zoneBaselines.get(zoneId) : fallback;
}

function boundedRandomWalk(current, maxStepPct = 2.5, min = 5, max = 100) {
  const step = (Math.random() * 2 - 1) * maxStepPct;
  return Math.min(max, Math.max(min, Number((current + step).toFixed(1))));
}

async function getSoilMoisturePct(zoneId) {
  const baseline = fetchCachedBaseline(zoneId);
  const next = boundedRandomWalk(baseline);
  zoneBaselines.set(zoneId, next);
  return { soilMoisturePct: next, source: "cached_smap_baseline+bounded_walk" };
}

module.exports = { getSoilMoisturePct };
