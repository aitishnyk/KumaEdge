# v0.3 Durable monitoring integration contract

**Not yet a database implementation.** The Bunny standalone Edge Script preview handles on-demand HTTP requests only.

A production adapter must implement atomic `readMonitor`, compare-and-swap `commitObservation` (state + sample + incident events), idempotent `claimNotification`, bounded `listSamples`, and expiring `claimLease`.

Required guarantees:
- Missing samples must never count as uptime.
- Duplicate scheduler ticks must not create duplicate incidents or alerts.
- Stale observations cannot overwrite newer state.
- Signed scheduler requests must include time bounds, replay prevention and constant-time secret comparison.
- No notification side effects on public GET endpoints.
- Fail closed if storage or optimistic concurrency checks fail.
- All configurable monitor URLs must be validated for SSRF, DNS rebinding, redirects and private IP ranges.

The pure transition engine in `src/monitoring/incident-engine.js` is ready for integration but not used by the live Bunny Edge API until a proven persistent adapter exists.

For the next release: validate a storage provider's atomic transactions under parallel requests, connect scheduler and retention, then test live Bunny deployments.
