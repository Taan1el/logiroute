# ADR 001: Native SQLite in WAL mode and Haversine distances

## Status
Accepted

## Context
The console needs to store vehicles, deliveries, geofences, alerts and position pings, and to answer two geometric questions: how far apart are two points, and is a vehicle inside a circular zone. A spatial database would add a service to run for a fleet of a few vehicles.

## Decision
1. Use the `node:sqlite` module that ships with Node.js (`DatabaseSync`) with `PRAGMA journal_mode = WAL`, foreign keys on and a 5 second busy timeout. There is no native module to compile and no database server to start. The file path comes from `DATABASE_URL` and the `:memory:` path is used in tests.
2. Compute distances with the Haversine formula on a sphere of radius 6371 km. Distances are rounded to 10 m, so a geofence check compares whole metres. Headings use the initial bearing from `atan2`.
3. Keep this math in `shared/geo.ts` as pure functions so the server and the browser demo run the same code.

## Consequences
- Setup is `npm install` and `npm run dev`; tests run against `:memory:` databases.
- Haversine on a sphere differs from true ellipsoidal distance by a fraction of a percent, which does not matter at city scale.
- Only circular geofences are supported. Polygons would need point-in-polygon tests.
- `DatabaseSync` blocks the event loop while a statement runs. That is fine for one dispatcher and a handful of vehicles, and would need a different driver for heavy ingest.
- Multi-step operations such as assigning a vehicle run as separate statements without a transaction.
