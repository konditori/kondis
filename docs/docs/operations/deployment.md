---
title: Deployment
---

# Deployment

Put the web client and API behind one HTTPS origin when possible. The development web server listens on `3000` and proxies API traffic to `2293`.

Use persistent volumes for PostgreSQL and uploaded activity files. Apply migrations during deployment, then check server health and open a read-only activity page before allowing clients to reconnect.
