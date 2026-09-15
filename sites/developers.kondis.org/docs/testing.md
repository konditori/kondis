---
title: Testing
---

# Testing

Kondis has unit, medium, and end-to-end test suites. If you are unsure, medium tests are usually the way to go.

## Server tests

Run the CI-equivalent server integration suite from any directory in the repository:

```sh
mise //server:test-medium
```

Run the server typecheck for the medium-test sources with:

```sh
mise //server:test-medium-typecheck
```

## End-to-end API tests

The API-level tests runs against a dockerized Kondis API backed by a real database.

```sh
mise //e2e:test
```

### Browser suite (Playwright)

The browser suite tests the whole stack, from the browser, web frontend, api backend, and database. 

```sh
mise //e2e:test-web
```
