---
title: Demo environments
---

# Demo environments

Kondis has a demo environment running at [demo.kondis.org](https://demo.kondis.org). This shows the
features of Kondis without having to install anything.

The demo environment runs on Cloudflare; see the [Cloudflare deployment guide's
Public demo section](./cloudflare/deployment) for how this is done.

In the demo environment, there is no authentication and you are instead immediately logged in to a demo account. For security reasons, all POST and PUT requests are disabled to protect against defacement. The demo environment has a number of sample activities loaded, including photos and comments by different (faked) users. In addition, there is a live ride on top of the page where you can follow the bike progress. The live run is done with a Durable Object that sends a new data point every 10 seconds.

The web frontend has static content only, and the activity photos are intentionally stored in there instead of something else like R2. We do this by statically generating all activity IDs on provisioning and then mapping the images to the same id.

## PR previews

We also deploy preview demo environments for PRs. The URL is pr-NNN.demo.kondis.org where NNN is the github PR number.
