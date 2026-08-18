import {
  activityControllerListBestEfforts,
  BestEffortSportInput,
  BestEffortType,
} from "$lib/api";
import { getServerSdkRequestOptions } from "$lib/server/api";
import type { BestEffortHistory } from "$lib/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const requestOptions = getServerSdkRequestOptions(locals.kondisFetch);
  const [run, ride] = await Promise.all(
    [
      ["run", BestEffortType.$5K],
      ["ride", BestEffortType.$10K],
    ].map(async ([sport, type]) => {
      try {
        return (await activityControllerListBestEfforts(
          {
            sport: sport as BestEffortSportInput,
            $type: type as BestEffortType,
          },
          requestOptions,
        )) as BestEffortHistory;
      } catch {
        return null;
      }
    }),
  );

  const histories = [run, ride].filter(
    (history): history is BestEffortHistory => history !== null,
  );
  const efforts = await Promise.all(
    histories.flatMap((history) =>
      history.options.map(async (option) => {
        let detail = history.type === option.type ? history : null;
        if (!detail) {
          try {
            detail = (await activityControllerListBestEfforts(
              {
                sport: history.sport as BestEffortSportInput,
                $type: option.type as BestEffortType,
              },
              requestOptions,
            )) as BestEffortHistory;
          } catch {
            // Keep the effort visible even if an individual history is unavailable.
          }
        }
        const best = detail?.efforts.toSorted(
          (left, right) => left.overallRank - right.overallRank,
        )[0];
        return {
          sport: history.sport,
          type: option.type,
          valueKind: option.valueKind,
          best: best ? { value: best.value, startedAt: best.startedAt } : null,
        };
      }),
    ),
  );

  return { efforts, unavailable: histories.length === 0 };
};
