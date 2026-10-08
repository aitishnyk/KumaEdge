/**
 * Portable, side-effect-free HTTP result classifier.
 * This is not a network probe, scheduler or Bunny runtime adapter.
 */
export function classifyHttpResult({ status, expectedStatus = 200, durationMs }) {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new RangeError("status must be a valid HTTP status");
  }
  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    throw new RangeError("expectedStatus must be a valid HTTP status");
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("durationMs must be a nonnegative finite number");
  }
  return Object.freeze({
    ok: status === expectedStatus,
    status,
    expectedStatus,
    durationMs
  });
}
