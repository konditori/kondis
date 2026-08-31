---
title: Developer overview
---

# Developer overview

Kondis is open source, self-hosted and licensed under AGPL 3.0-or-later. We want your help in developing this app to be the best fitness tracker possible.

The git repo is a monorepo that contains the entire project (with some minor exceptions).

Here is a breakdown of the main project folders:

- **`server/`**: Backend and API, this is where the core processing happens. Built on NestJS and Typescript.
- **`web/`**: Web frontend built on Svelte and Typescript.
- **`android/`**: Android app, written in kotlin.
- **`docs/`**: Documentation site, built on Docusaurus. This site contains the user documentation and is hosted on [docs.kondis.org](https://docs.kondis.org).
- **`static/`**: Static websites that are deployed separately from the main Kondis application.
- **`static/apps/kondis.org`**: The [kondis.org](https://kondis.org) website, built on Svelte and Typescript.
- **`static/apps/developers.kondis.org`**: The developer documentation site that you're currently reading at [developers.kondis.org](https://developers.kondis.org) website, built on Svelte and Typescript.
- **`docker/`**: Docker scripts used to orchestrate the stack
- **`i18n/`**: Translation files
- **`e2e/`**: End-to-end test files

There is a separate [test-assets](https://github.com/konditori/test-assets) repository that stores files used in testing. We keep that separate to avoid bloating the main repo.

## Architecture

Kondis uses a client-server design and a postgres database. The clients are the web or android frontends, while the server code is the backend. The backend uses job queues that are handled by a separate part of the backend called the worker. This is to keep the main thread fast while the worker performs heavier tasks like activity importing and image resizing. The worker job queues are handled with [pg-boss](https://github.com/timgit/pg-boss).