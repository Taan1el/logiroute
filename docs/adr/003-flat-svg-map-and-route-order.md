# ADR 003: Flat SVG map and nearest-stop route order

## Status
Accepted

## Context
A dispatcher needs to see where vehicles are and in which order each one will visit its stops. A tile map library would need an API key or a tile server and a network connection, which the GitHub Pages demo should not depend on.

## Decision
1. Draw the map as inline SVG. Latitude and longitude between 59.400..59.455 and 24.690..24.830 are projected linearly onto a 1000 by 770 viewBox, whose ratio matches the real ground ratio at that latitude. Coordinates outside the box are clamped to its edge. Zones are scaled with a fixed metres-to-pixels factor, and the 1 km scale bar uses the same factor.
2. The ground, the bay, the lake and the three main streets are rough hand-placed shapes. They orient the viewer; the picture is not a survey.
3. Order the stops of each vehicle with a nearest-neighbour heuristic (`planRoute` in `shared/route.ts`): from the vehicle position, always go to the closest remaining stop, ties by list order. It is cheap and predictable and it is not an optimal tour. A test pins a case where it picks a longer tour than the best one.
4. Leg lengths are straight lines and ETAs assume 30 km/h with no traffic or service time.
5. Every fact on the map is also available as text: the SVG has a title and a description, there is a table view of the same stops, and a stop timeline sits beside the map.

## Consequences
- No keys, no tiles, no requests; the demo works offline once loaded.
- Routes are drawn as straight segments, not along streets.
- The projection is only meaningful for the fixed Tallinn bounds above.
- Replacing `planRoute` with an exact or road-aware planner only touches `shared/route.ts`.
