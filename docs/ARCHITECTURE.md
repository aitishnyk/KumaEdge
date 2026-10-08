# Architecture — pre-alpha proposal

The objective is an edge-first uptime monitor deployable without a self-managed VPS.

## Proposed components

- **Frontend:** static assets served by Bunny CDN (Vue-based interface is planned, not yet implemented).
- **API:** Bunny Edge Scripts adapter with origin validation, auth, rate limits, and server-only secrets (not yet implemented).
- **Checks:** outbound HTTP(S) probes with strict URL and network destination policy. The portable probe module is only a prototype.
- **Scheduling:** needs a documented and verified external/managed scheduler or tested Bunny-native mechanism. Do not imply that an Edge Script stays alive or has an arbitrary cron.
- **Storage:** durable, concurrency-safe records for monitors, checkpoints, incidents, and rollups. Technology selection pending validation.
- **Notifications:** deduplicated outbound notifications driven by persisted incident transitions.
- **Multi-region:** add independent probes only when their execution regions are verified.

## Critical security boundaries

A public monitoring service is an SSRF-sensitive application: validate target schemes, DNS, redirects and resolved IP ranges, including IPv4/IPv6 private, loopback, link-local, metadata addresses and rebinding. Never allow clients to submit privileged arbitrary URLs to an unauthenticated backend.

Require authz for monitors; isolate tenants; encrypt sensitive integration secrets; enforce bounded response size, timeout, request rate and outbound destination; prevent replay in scheduled jobs.

## Compatibility scope

HTTP(S) first. ICMP, raw TCP, Docker host probes and private-network monitors need optional agent(s) and are **not** provided by edge scripts by default.

No Bunny deployment, database persistence or continuous monitoring is claimed at this stage.
