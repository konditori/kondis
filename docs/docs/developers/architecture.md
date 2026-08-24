---
title: Architecture
---

# Architecture

The Svelte web app talks to the server API and subscribes to activity events. The server owns authentication, uploads, analysis, social actions, storage, and PostgreSQL persistence. Android uses a local Room database and a sync worker so recordings work offline.

Activity parsing is asynchronous: an upload is accepted, queued, and later materialized as an activity. Clients should read processing status or subscribe to events instead of assuming parsing finished with the HTTP request.

Database migrations are discovered at runtime from `server/src/schema/migrations`.
