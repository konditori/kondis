---
title: Cursed knowledge
---

# Cursed knowledge

Cursed knowledge we have learned while building Kondis that we wish we never needed to know.

## 2026-08-11: Strava takeout crops are cursed

Strava takeouts do not store activity crop boundaries. The takeout can contain the original, untrimmed activity file while `activities.csv` contains summary metrics for the edited activity. Because there is no crop information, Kondis cannot import that edit faithfully. Each cropped workout needs to be re-cropped manually.
