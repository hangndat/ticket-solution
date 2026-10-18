# PR #449 — refresh single-flight limits (Task #416)

| Field | Value |
| --- | --- |
| Scope | `apps/portal` staff refresh coalescing |
| Date | 2026-10-18 |
| Architecture | ADR-20 / OIDC session |

## What shipped

Per-process single-flight keyed by `SHA-256(issuer || clientId || refreshToken)` plus a bounded 5s result cache (max 64 entries). Concurrent BFF waiters share one IdP exchange and each applies the verified grant to its own cookie jar. Failures clear the staff jar and the flight cache. Raw refresh tokens are never logged.

## Multi-instance limitation (not distributed-safe)

This Map lives in one Node process only. Multiple portal replicas (or multiple Node workers) can still race Keycloak refresh-token rotation: a loser on another instance may receive `invalid_grant` and clear cookies independently.

**Do not claim distributed safety** from this change. Before production horizontal scale, add a shared lock/cache (or serialize refresh behind a sticky session / dedicated refresh endpoint) and re-validate with parallel BFF evidence across instances.
