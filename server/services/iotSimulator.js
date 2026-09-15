/**
 * iotSimulator.js
 *
 * Stands in for real ground displacement sensors (see feasibility
 * analysis in IMPLEMENTATION_PLAN.md). Emits a plausible mm/day
 * displacement value per zone, with an in-memory "triggered" flag
 * so the demo can force a spike live in front of judges.
 */

const zoneState = new Map(); // zoneId -> { baseline, triggeredUntil }

function getDisplacement(zoneId) {
  const state = zoneState.get(zoneId) || { baseline: 0.5 + Math.random() * 1.5, triggeredUntil: null };

  const now = Date.now();
  let value;

  if (state.triggeredUntil && now < state.triggeredUntil) {
    // Forced critical event window for demo purposes
    value = 8 + Math.random() * 4; // 8-12 mm/day, well above critical threshold
  } else {
    // Normal noisy baseline
    value = Math.max(0, state.baseline + (Math.random() * 0.6 - 0.3));
    state.baseline = value;
  }

  zoneState.set(zoneId, state);
  return Number(value.toFixed(2));
}

/**
 * Call this from a "Trigger Critical Event" demo button to force a
 * displacement spike on a given zone for durationMs milliseconds.
 */
function triggerCriticalEvent(zoneId, durationMs = 5 * 60 * 1000) {
  const state = zoneState.get(zoneId) || { baseline: 0.5, triggeredUntil: null };
  state.triggeredUntil = Date.now() + durationMs;
  zoneState.set(zoneId, state);
}

module.exports = { getDisplacement, triggerCriticalEvent };
