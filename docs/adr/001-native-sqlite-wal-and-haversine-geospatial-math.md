# ADR 001: Native SQLite WAL and Haversine Geospatial Mathematics

## Status
Accepted

## Context
Fleet logistics systems processing vehicle coordinates and geofence boundary crosses frequently require geospatial queries. In enterprise architectures, teams often introduce PostGIS or external spatial GIS engines, introducing substantial container footprint, network overhead, and complex local developer setup. 

For the Tallinn Urban Logistics Corridor platform, we required:
1. Zero-dependency local developer execution (`npm run dev` out of the box without requiring Docker daemons or external spatial databases).
2. High-throughput GPS telemetry ingestion and audit logging with sub-millisecond ACID transactions.
3. Microsecond mathematical computation of Great-Circle distances, circular geofence containment, and azimuth headings between coordinates.

## Decision
1. **Node.js 24 Native `node:sqlite` (`DatabaseSync`)**:
   - Utilize Node.js's built-in SQLite driver in WAL (Write-Ahead Logging) mode.
   - Eliminates all native C++ build tools (`node-gyp`, Python, MSBuild) and external Docker database dependencies.
   - Enforces relational foreign keys, cascade deletes, and indexed spatial queries.

2. **In-Memory Haversine & Azimuth Engine (`GeoService`)**:
   - Compute Great-Circle arc distances via spherical trigonometric Haversine formula ($R = 6371\text{ km}$).
   - Fast boundary containment checks: $\text{distance}(P_{\text{vehicle}}, P_{\text{center}}) \le r_{\text{geofence}}$.
   - Compute true compass bearing azimuth (0..360°) via 2-argument arctangent ($\text{atan2}$).

## Consequences
- **Positive**: Sub-millisecond queries, zero native compilation failures on developer machines, zero external database setup.
- **Positive**: Comprehensive unit test isolation using in-memory `:memory:` databases with instant teardown.
- **Trade-off**: Complex multi-polygon GIS shapes (e.g. GeoJSON multipolygons) require custom point-in-polygon ray casting if expanded beyond circular perimeters.
