---
sidebar_position: 3
title: Configuration
---

# Configuration

Copy `docker/env.example` to a private environment file and configure the server and database together:

```bash
cp docker/env.example .env
docker compose -f docker/docker-compose.dev.yml up
```

Never commit secrets. When changing database settings, update both services, restart them, and inspect logs before troubleshooting the web client.
