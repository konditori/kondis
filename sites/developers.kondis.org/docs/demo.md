---
title: Demo environment
---

# Demo environment

Kondis has a demo environment running at [demo.kondis.org](https://demo.kondis.org). This shows the features of Kondis without having to install anything.

The demo environment runs on Cloudflare; see the [Cloudflare deployment guide](./cloudflare) for how this is done.

The web and api workers serving the demo site have been deployed with `KONDIS_DEMO_MODE=true` which does the following:

- No authentication, it automatically logs in as the demo user John Doe
- POST and PUT requests are disabled and return 403
- No R2 storage, all images are statically deployed in the frontend
- No job queues, all activities are prepopulated

The demo environment has a number of sample activities loaded, including photos, comments, and likes by other (faked) users. In addition, there is a live ride on top of the page where you can follow the bike progress. The live run is done with a Durable Object that sends a new data point every 10 seconds.

The web frontend has static content only, and the activity photos are intentionally stored in there instead of something else like R2. We do this by statically generating all activity IDs on provisioning and then mapping the images to the same id.

## Deployment

Since there is no suitable database environment on Cloudflare, we run the demo database on a separate cloud machine. Due to limited resources on this machine, there is not enough memory and storage to deploy a full Kondis app in order to do database migrations and seeding. Instead, we run this through Github Actions that connects to the database over a Cloudflare tunnel and performs the provisioning. By having static, pre-generated uuids, we can then seed the web and api workers with static content as well without having to run job queues.

## PR previews

We also deploy preview demo environments for PRs. The URL is pr-NNN.demo.kondis.org where NNN is the github PR number.
