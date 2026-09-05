---
title: Authentication
---

# Authentication on Cloudflare Workers

This deployment policy reflects Cloudflare platform limits as of September 2026.

Kondis local authentication stores passwords with bcrypt using work factor 12. This is the supported default for container and Node.js deployments.

## Workers plans

[Workers Free allows 10 ms of CPU time per HTTP request](https://developers.cloudflare.com/workers/platform/limits/#cpu-time). Password hashing is deliberately CPU-intensive, and bcrypt with work factor 12 cannot reliably complete within that budget. Replacing bcrypt with a fast hash or reducing its work factor enough to fit would weaken stored passwords and is not supported.

Use the authentication mode appropriate for the deployment:

| Deployment           | Authentication                                                     |
| -------------------- | ------------------------------------------------------------------ |
| Container or Node.js | Kondis local authentication with bcrypt work factor 12             |
| Workers Paid         | Kondis local authentication with bcrypt work factor 12             |
| Workers Free         | Cloudflare Access, or upgrade before enabling local authentication |

Other password KDFs do not remove the Free-plan constraint. Strong Argon2id, scrypt, and PBKDF2 configurations are also designed to exceed a very small CPU budget, while JavaScript and WebAssembly implementations add runtime overhead.

## Cloudflare Access mode

[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/) is an optional authentication mode for small Workers deployments. Its free tier supports up to 50 users, which covers the expected size of most individual, family, and small-group instances. Access delegates login to Cloudflare, email one-time PIN, or a configured identity provider, so the Worker does not receive or hash a user password.

Access must be the authoritative identity provider in this mode, not only an additional gateway in front of the normal Kondis login. An Access deployment must:

- protect every application and API route;
- validate the signature, issuer, and audience of the `Cf-Access-Jwt-Assertion` token;
- map the validated Access identity to a Kondis user;
- disable local password registration and login endpoints so they cannot bypass Access; and
- configure [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/) for native clients.

Instances that need local password accounts, more than 50 Access users, or authentication independent of Cloudflare should use a container deployment or Workers Paid. Do not automatically downgrade the bcrypt work factor when deploying to Workers Free.

See Cloudflare's guidance for [validating Access tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
