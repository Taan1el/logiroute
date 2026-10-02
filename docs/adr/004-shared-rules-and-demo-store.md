# ADR 004: Shared rules and an in-browser demo store

## Status
Accepted

## Context
The GitHub Pages build has no server. A demo that reimplements the business rules would drift from the API.

## Decision
- Put the pure rules in `shared/`: types, geometry, validation, status transitions, alert evaluation, ETA, metrics, route planning and the fleet simulation step. The server services and the client both import them.
- In the Pages build (`vite --mode pages`, flag `VITE_DEMO_MODE`), `client/src/services/index.ts` selects `createDemoBackend` instead of the HTTP client. Both implement the same `Backend` interface. The demo backend keeps a copy of the sample data in memory, applies the shared rules, and forgets everything on reload or on "Reset sample data".
- Sample data has fixed ids, addresses and positions. Only timestamps are offsets from the current time, so the 24 hour counters stay meaningful.
- Client tests run the real HTTP client against a `fetch` stub that routes to the demo backend.

## Consequences
- Demo behavior and server behavior change together when a rule changes.
- The demo does not cover persistence, concurrency or HTTP error handling; the server tests do.
