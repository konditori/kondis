---
sidebar_position: 3
title: Initial setup
---

# Initial setup

By default, Kondis will start listening on port `3000` which means you can access the frontend by opening your web browser to `http://<server-ip>:3000`. In the future this will change to another port as we develop a production docker compose.

You will be asked for a setup token. This is found in the server log on startup.

```bash title="Setup token in logs"
kondis_server    | ================================================================================
kondis_server    | Welcome to Kondis!
kondis_server    |
kondis_server    | For initial setup, go to the app in a web browser (not mobile app)
kondis_server    |
kondis_server    | You will need the following setup token:
kondis_server    |
kondis_server    |    45b8e5a1-684e-41af-9838-4fc3ac9a6644
kondis_server    |
kondis_server    | Do not share this secret token with anyone.
kondis_server    |
kondis_server    | ================================================================================
```

Do not share this setup token with anyone but you only need to enter it once to prove you control the server. After entering the correct token you will be able to create the admin account.

For automated provisioning, set `KONDIS_SETUP_TOKEN` to a secret containing
32-512 characters before the first startup. Generate one with
`openssl rand -hex 32`; do not commit it or pass it as a command-line argument.
