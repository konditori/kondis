---
sidebar_position: 1
title: Installation
---

# Installation

The repository includes Docker Compose files for development. Keep PostgreSQL and uploaded activity data on persistent storage.

## Requirements

- Docker Engine and Docker Compose
- Persistent disk storage
- HTTPS through a reverse proxy for remote access

```bash
git clone https://github.com/kondis-app/kondis.git
cd kondis
docker compose -f docker/docker-compose.dev.yml up --build
```

Open `http://localhost:3000`. The web app proxies API requests to the server on port `2293`.

Before exposing Kondis publicly, configure HTTPS, restrict database access, set strong secrets, and establish tested backups.
