---
sidebar_position: 1
slug: /
title: About Us
---

# Kondis

Kondis is an open-source, self-hosted fitness tracker licensed under AGPL 3.0. It aims to become a fully functional tracker primarily focused on endurance sports.

## The backstory

I, [Jonathan Jogenfors](https://jogenfors.com), was tired of the usual commercial fitness trackers, not least because of their high subscription costs, limited features, and stalled development. Going down the self-hosting path naturally means giving up the social features, but the more I thought about it, the less I cared. I want to exercise, not brag to friends about my modest performance.

Developing a brand-new fitness app didn't seem that difficult since there actually aren't any hard problems to solve, just a bunch of smaller problems that can be tackled one by one.

In 2026, I had done enough thinking and just started implementing, seeing where this all would land. Since I have been contributing to the Immich project for several years, I had seen its architecture evolve over time, which helped me with the usually difficult initial choices: NestJS, Postgres with VectorChord, and Svelte. However, I made the conscious decision to avoid Flutter since it never felt like the right choice to me. Instead, I decided to try my luck with native mobile apps.

The name? In Swedish (and other Nordic languages), "Kondition" means "(physical) condition/health, shape, stamina." The slang term is "Kondis," which is short and sweet yet quirky enough to be memorable. The 😰 emoji was just added as an afterthought; let's see if we keep it.

In the end it wasn't too difficult to build a functioning MVP, just a bunch of moving parts that I had to tie together. Immich has an extremely useful job queue that I imitated using pg-boss, VectorChord performs map-similarity searches, and it took some trial and error to get the elevation and moving-time calculations right. Dusting off that old Java knowledge, I got the Kotlin-based Android app tracking my workouts as well.

Then, of course, I do need to disclose that I work at Cloudflare. Slap on a bunch of cloudflared tunnels for remote connectivity and Cloudflare Workers for hosting the docs, and we're off.

The unique selling point of commercial fitness trackers is that they're brain-dead easy to get going. But let's make Kondis shiny enough for people to consider switching, make it work well enough for them not to throw it out, and, very importantly, make it _fast_.

In fact, that's another inspiration from Immich where jrasm91 said "Make it shiny. Make it work. Make it right. Make it fast."

With self-hosting, I believe fitness tracking can find its home. Log your exercises, store them privately, share progress with your closest friends and family, and use in-app live tracking for safety. I am certain that we can help many nerds get fit by setting up a Kondis instance. There really aren't any unique selling points left for commercial trackers! As of September 2026, I am progressing from the initial concept to a fully functional app and we're moving fast. I hope you will be inspired to join.

For a more up-to-date view of current features and goals, see our [GitHub page](https://github.com/konditori/kondis).

## Where to go from here

- [Our Discord server](https://discord.gg/jKjtYVe9uZ)
- [The Kondis subreddit](https://reddit.com/r/kondis)
- [System requirements](install/requirements)
- [Install Guide](install/installation)
- [Developer documentation](https://developers.kondis.org/)
- [API reference](https://api.kondis.org/introduction)
