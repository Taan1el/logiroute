# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Automated accessibility checks (axe, WCAG 2 A and AA rules) for the map view, the table view and the new delivery dialog. The checks found no violations, so no UI changes were needed.
- A test that checks every sideways scroll area (route map and stops table) is a named region reachable by keyboard, so the fix cannot regress unnoticed.

## [1.0.0] - 2026-10-02

### Added

- Route map of central Tallinn as inline SVG with numbered stops, one planned route per vehicle, zones, pending drop-offs and a text description, plus a table view of the same stops.
- Stop order per vehicle from a nearest-neighbour heuristic, with straight-line leg distances and ETAs at a planning speed of 30 km/h.
- Stop timeline, vehicle list, delivery list, alert list and a position ping form in a single dispatch column, with a status bar of fleet counts.
- New delivery dialog that reports validation errors from the API without closing.
- Shared rules in `shared/` (geometry, validation, status transitions, alert evaluation, ETAs, metrics, route planning) used by the server and the client.
- In-browser demo backend with fixed sample data, a demo bar, and a Pages build (`npm run build:pages`) that works under the `/logiroute/` base path.
- GitHub Actions workflows: CI on Node 22 and 24 (lint, tests, builds, Docker build) and a Pages workflow that deploys only when the repository is public.
- Server tests for routes, validation and rules, and client tests for the console, the demo backend and the demo bar.
- Architecture decision records, MIT license, environment examples and package metadata.

### Fixed

- Delivery coordinates are validated before distance and ETA are calculated (finite numbers in range, zero allowed, strings and `null` rejected).
- Delivery statuses move one step forward only, and a vehicle is required once a delivery is dispatched.
- Vehicles in maintenance can no longer be assigned deliveries, and a vehicle with active deliveries cannot be set idle or into maintenance.
- Metrics count completed deliveries and alerts from the last 24 hours; completed deliveries used to be counted without a time limit.
- Malformed JSON bodies get a 400 response, unknown `/api` paths a 404, and unknown vehicles and deliveries a 404 instead of a 500.
- The alert limit is clamped, and the client metrics fallback uses the field names the API returns.
- The low-battery shortcut picks a vehicle that is still above the threshold so it raises an alert.
- The database file is ignored by git, the start script and Docker entry point match the compiled output, and the image serves the built client.
