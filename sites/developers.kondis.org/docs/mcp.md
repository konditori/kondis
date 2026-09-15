---
sidebar_position: 5
title: MCP server
---

# MCP server

Kondis exposes an MCP endpoint at `/mcp` for assistants that support Streamable HTTP.

## Connect

1. Sign in to Kondis and open **Settings > Connected apps**.
2. Create a credential with only the scopes the client needs.
3. Configure the client with the MCP endpoint shown in Connected apps and use the generated bearer token.

OAuth-capable clients can use the same endpoint and complete the browser consent flow instead of managing a token.

## Capabilities

The server provides owner-scoped activity search and detail, bounded sensor streams, training summaries, comparisons, route efforts, best efforts, and athlete context. Clients with write permissions can create or update activities. Import clients first upload a FIT, GPX, or TCX file to `POST /mcp/uploads`, then pass the returned upload ID to `start_activity_import`.

Coordinates and routes additionally require `location:read`. Mutations require an idempotency key; edits require the current activity revision.

## Self-hosting

Set `KONDIS_MCP_PUBLIC_URL` to the externally reachable HTTPS URL ending in `/mcp`. Loopback HTTP is allowed for local development. Node deployments behind the Kondis proxy must also set `KONDIS_TRUST_PROXY_HEADERS=true`.
