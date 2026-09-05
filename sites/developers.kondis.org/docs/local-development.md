---
title: Local development
---

# Local development

For local development, please begin by checking the [Kondis system requiements](https://docs.kondis.org/install/requirements) but add quite a bit of disk space.

All the apps below will be accessible at `http://localhost:3000`, meaning you can only run one at a time.

## Kondis app

After cloning the git repo, run the app with the following command:

```bash
mise dev-update
```

This will start the main docker compose stack.

The web app will be accessible `http://localhost:3000`.

### Limiting container CPU usage

To limit CPU usage for all development containers, add `KONDIS_DEV_CPUS` to
`docker/.env`. It supports fractional CPUs, for example:

```dotenv
KONDIS_DEV_CPUS=0.5
```

## Resetting development data

To clear activities, uploads, images, live workouts, social data, notifications, and queued jobs without redoing setup, run:

```bash
mise dev-reset-data
```

It preserves all user accounts, including admin roles, passwords, and avatars. This command is for the local development stack only.

## Docs site

Go to the docs site folder

```bash
cd sites/docs.kondis.org
```

Then run

```bash
mise dev
```

## Developer docs site

Go to the developer docs site folder

```bash
cd sites/developers.kondis.org
```

Then run

```bash
mise dev
```

## kondis.org site

```bash
cd sites/kondis.org
```

Then run

```bash
mise dev
```

## API reference site, api.kondis.org

```bash
cd sites/api.kondis.org
```

Then run

```bash
mise dev-update
```
