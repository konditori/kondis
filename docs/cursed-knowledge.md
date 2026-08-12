# Cursed Knowledge

Cursed knowledge we have learned while building Kondis that we wish we never needed to know.

## 2026-08-11: Strava takeout crops are cursed

Strava takeouts do not store activity crop boundaries. The takeout can contain the original, untrimmed activity file while `activities.csv` contains summary metrics for the edited activity. However, because there is no crop information there is no way to import this data from Strava. Each cropped workout therefore needs to be re-cropped manually in Kondis.