---
title: Troubleshooting
---

# Troubleshooting

## The web app cannot load activities

Confirm the server is running, inspect logs, and check database health. Locally, the API is expected on port `2293` behind the web app at `3000`.

## An upload is stuck

Uploads are queued. Check server logs and database connectivity before retrying; repeated uploads can create duplicates.

## Android does not sync

Verify the server URL, account session, network access, and the app's pending sync state. Offline recordings remain on-device until the server is reachable.

## Migration errors

Stop the deployment and take a database backup. Never edit an applied migration in place. Migrations live in `server/src/schema/migrations` and must implement both `up` and `down`.
