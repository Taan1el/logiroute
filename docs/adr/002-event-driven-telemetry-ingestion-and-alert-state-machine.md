# ADR 002: Event-Driven Telemetry Ingestion and Reactive Alert State Machine

## Status
Accepted

## Context
Fleet operations teams monitor hundreds of delivery vehicles moving through urban centers like Tallinn. Operators need instant notification when:
- Vehicles enter or leave designated depot hubs (e.g. Vabaduse Väljak Central Hub, Ülemiste Smart City Depot).
- Delivery vehicles exceed municipal speed limits (e.g. > 50 km/h in urban zones).
- Electric vehicle batteries enter critical depletion thresholds (< 15%).
- Transit orders reach proximity of their destination dropoff hub.

## Decision
1. **Telemetry Pipeline (`TelemetryService`)**:
   - Every GPS ingestion ping contains: `vehicle_id`, `lat`, `lng`, optional `speed_kmh`, `battery_percent`, and `heading_deg`.
   - The service compares previous position against current position for all registered active geofences:
     - Transition $\text{outside} \to \text{inside}$: triggers `geofence_entered` (Severity: `info`).
     - Transition $\text{inside} \to \text{outside}$: triggers `geofence_exited` (Severity: `warning`).
   - Evaluates speed violation: $\text{speed} > 50\text{ km/h} \implies \text{overspeed\_detected}$ (Severity: `warning`).
   - Evaluates battery health: $\text{battery} < 15\% \land \text{prevBattery} \ge 15\% \implies \text{low\_battery}$ (Severity: `critical`).

2. **Autonomous Delivery Progress & Proximity Trigger**:
   - Ingested vehicle telemetry recalculates the dynamic ETA of all active deliveries assigned to that vehicle.
   - When distance to dropoff point reaches $\le 80\text{ meters}$, the system automatically transitions delivery status from `in_transit` to `arrived_at_hub`.

## Consequences
- **Positive**: Deterministic rule execution, audit log retention in `telemetry_pings` and `alert_events` tables.
- **Positive**: Zero latency in alert propagation; alerts return synchronously in ingestion response and populate the live operations feed.
