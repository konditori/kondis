---
sidebar_position: 5
title: MCP server
---

# MCP server

Kondis exposes an MCP endpoint at `/mcp` for you to play with.

## Capabilities

### Tools

- `compare_activities` - Compare activities and show differences relative to the first.
- `compare_route_efforts` - Retrieve previous efforts on a matched route and their metrics.
- `create_manual_activity` - Record a completed workout.
- `get_activity` - Read an activity summary, revision, metrics, and laps.
- `get_activity_streams` - Read aligned sensor samples such as speed, heart rate, cadence, and power.
- `get_athlete_context` - Read athlete preferences, supported sports, and granted scopes.
- `get_best_efforts` - Read personal best efforts and rankings by effort type, sport, and year.
- `get_operation` - Inspect a durable mutation or import operation.
- `search_activities` - Search activities by date, metrics, and tags.
- `start_activity_import` - Process an upload staged through the MCP upload endpoint.
- `summarize_training` - Calculate weekly or monthly training volume and intensity.
- `update_activity` - Edit an activity using its current revision.

## Deployment

Set `KONDIS_MCP_PUBLIC_URL` in the env file to the externally reachable HTTPS URL ending in `/mcp`. Loopback HTTP is allowed for local development. Local deployments must also set `KONDIS_TRUST_PROXY_HEADERS=true`.
