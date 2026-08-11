# Cursed Knowledge

Cursed knowledge we have learned while building Kondis that we wish we never needed to know.

## Strava takeout crops are cursed

Strava takeouts do not store activity crop boundaries. The takeout can contain the original, untrimmed activity file while `activities.csv` contains summary metrics for the edited activity, but it has no crop flag, retained start/end offsets, or sample indexes. No other file in the takeout supplies that missing relationship, so the exact crop cannot be reconstructed reliably.

Found 2026-08-11.

References: [Strava Crop Tool](https://support.strava.com/en-us/articles/15401992-crop-tool-for-activities), [Exporting Your Data and Bulk Export](https://support.strava.com/en-us/articles/15401919-exporting-your-data-and-bulk-export)
