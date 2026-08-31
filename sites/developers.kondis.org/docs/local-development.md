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

## Docs site

Go to the docs site folder

```bash
cd sites/docs.kondis.org
```

Then run

```bash
mise dev-update
```

## Developer docs site

Go to the developer docs site folder

```bash
cd sites/developers.kondis.org
```

Then run

```bash
mise dev-update
```

## kondis.org site

```bash
cd sites/kondis.org
```

Then run

```bash
mise dev-update
```

## API reference site, api.kondis.org

```bash
cd sites/api.kondis.org
```

Then run

```bash
mise dev-update
```
