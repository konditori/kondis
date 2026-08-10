import { activityControllerDeleteById, activityControllerListRecent, activityControllerUpdateById } from '@kondis/sdk';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { utils as e2e } from '../../../utils';

const fitFixturePath = 'activities/running/2015-hindas/2015-06-22-run.fit';
const orsaTcxFixturePath = 'activities/alpine-ski/2013-01-13-orsa.tcx';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';
const UPDATED_NAME = 'e2e-updated-name';
const UPDATED_SUB_SPORT = 'recovery';
const UPDATED_STARTED_AT = '2024-01-02T03:04:05.000Z';

beforeEach(e2e.cleanup);
afterAll(e2e.cleanup);

describe('GET /activities', () => {
  it('lists a parsed activity after upload processing completes', async () => {
    const activity = await e2e.createActivity(fitFixturePath);

    const { activities } = await activityControllerListRecent();
    expect(activities.find((candidate) => candidate.id === activity.id)).toBeDefined();
  });

  it('parses the Orsa TCX fixture with expected summary values', async () => {
    const activity = await e2e.createActivity(orsaTcxFixturePath, 'application/xml');

    expect(activity.sport).toBe('other');
    expect(activity.startedAt).toBe('2013-01-13T09:17:34.000Z');
    expect(activity.elapsedTime).toBe(10_962);
    expect(activity.movingTime).toBe(10_962);
    expect(activity.distance).toBeCloseTo(29_823.963165283203, 3);
    expect(activity.calories).toBe(1690);
  });
});

describe('PUT /activities/:id', () => {
  it('updates the name field', async () => {
    const activity = await e2e.createActivity(fitFixturePath);

    const updated = await activityControllerUpdateById({
      id: activity.id,
      activityUpdateDto: { name: UPDATED_NAME },
    });

    expect(updated.name).toBe(UPDATED_NAME);
  });

  it('updates the subSport and startedAt fields', async () => {
    const activity = await e2e.createActivity(fitFixturePath);

    const updated = await activityControllerUpdateById({
      id: activity.id,
      activityUpdateDto: {
        subSport: UPDATED_SUB_SPORT,
        startedAt: UPDATED_STARTED_AT,
      },
    });

    expect(updated.subSport).toBe(UPDATED_SUB_SPORT);
    expect(updated.startedAt).toBe(UPDATED_STARTED_AT);
  });

  it('returns 404 for a missing activity id', async () => {
    await expect(
      activityControllerUpdateById({ id: MISSING_UUID, activityUpdateDto: { name: 'missing' } }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('DELETE /activities/:id', () => {
  it('deletes an existing activity', async () => {
    const activity = await e2e.createActivity(fitFixturePath);

    await activityControllerDeleteById({ id: activity.id });

    const { activities } = await activityControllerListRecent();
    expect(activities.find((candidate) => candidate.id === activity.id)).toBeUndefined();
  });

  it('returns 404 for a missing activity id', async () => {
    await expect(activityControllerDeleteById({ id: MISSING_UUID })).rejects.toMatchObject({ status: 404 });
  });
});
