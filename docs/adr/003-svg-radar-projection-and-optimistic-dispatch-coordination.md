# ADR 003: SVG Radar Projection and Optimistic Dispatch Coordination

## Status
Accepted

## Context
Standard web mapping libraries (Mapbox GL, Leaflet, Google Maps) require heavy external CDN scripts, WebGL canvas bindings, and proprietary API keys. Dispatch operators and engineers need instant, zero-friction verification without registering third-party billing keys or experiencing CSP blocking.

Furthermore, dispatch operators need seamless visual correlation between active vehicle coordinates, geofence perimeters, and assigned consignment delivery trajectories.

## Decision
1. **Interactive SVG Coordinate Projection (`LogisticsMap`)**:
   - Project WGS84 geographic coordinates $(\text{lat}, \text{lng})$ within the Tallinn urban bounding box ($\text{lat} \in [59.395, 59.455], \text{lng} \in [24.690, 24.830]$) onto an 840x520 vector viewport.
   - Scale geofence radial meters to SVG pixel units using latitude-meter conversion ($1^\circ \approx 111,320\text{ m}$).
   - Render vehicle markers with dynamic compass heading rotation (`transform="rotate(heading_deg)"`), status rings, and speed indicators.
   - Render delivery routes with dashed vector lines, origin hubs, and destination pins with remaining ETA.

2. **Full Lifecycle State Synchronization**:
   - Deliveries progress through a strict finite state machine: `pending` $\to$ `dispatched` $\to$ `in_transit` $\to$ `arrived_at_hub` $\to$ `completed`.
   - Vehicle statuses (`idle`, `en_route`, `maintenance`) synchronize automatically with consignment assignments.

## Consequences
- **Positive**: Zero external API key dependencies, instant rendering, lightweight bundle size (< 250 KB total client).
- **Positive**: Full responsiveness, high frame rate vector rendering, accessible SVG markup.
