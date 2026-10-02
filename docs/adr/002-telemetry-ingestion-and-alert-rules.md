# ADR 002: Telemetry ingestion and alert rules

## Status
Accepted

## Context
Dispatchers want to know when a vehicle enters or leaves a zone, drives too fast or runs low on battery, and want delivery ETAs to follow the vehicle. Position reports arrive one at a time through `POST /api/telemetry/ingest`.

## Decision
1. Every ping is validated (finite coordinates in range, speed 0..300, battery 0..100, heading 0..360) and then evaluated by one pure function, `evaluateTelemetry`, in `shared/rules.ts`. It compares the previous position with the new one:
   - outside to inside raises `geofence_entered` (info) and inside to outside raises `geofence_exited` (warning), when the zone has that alert switched on;
   - speed above 50 km/h raises `overspeed_detected` (warning) on every such ping;
   - battery that falls below 15% from 15% or more raises `low_battery` (critical) once, not on every later ping.
2. After the ping is stored, `progressDeliveries` recomputes the ETA of the vehicle's dispatched and in-transit deliveries from the remaining straight-line distance, using at least 25 km/h so a stopped vehicle does not get an endless ETA. An in-transit delivery within 80 m of its drop-off moves to `arrived_at_hub`.
3. Delivery statuses move one step forward only: `pending`, `dispatched`, `in_transit`, `arrived_at_hub`, `completed`. A vehicle is required from `dispatched` on, and a vehicle in maintenance cannot take deliveries.
4. The alerts created by a ping are returned in the ingest response and stored in `alert_events`. Pings are stored in `telemetry_pings`; nothing reads them back yet.

## Consequences
- The rules are deterministic and covered by unit tests without a database.
- The browser demo applies the same functions to in-memory data.
- ETAs are straight-line estimates. They ignore roads, traffic and service time.
- The speed limit and battery threshold are constants, not per-vehicle or per-zone settings.
