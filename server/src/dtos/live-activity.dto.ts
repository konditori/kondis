import { z } from '@hono/zod-openapi';

import { ActivityTypeSchema } from 'src/dtos/activity.dto';

const LiveActivityStatusSchema = z.enum(['recording', 'paused', 'ended', 'discarded']);
export const LivePointSchema = z.object({
  sequence: z.number().int().positive(),
  recordedAt: z.string().datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  altitude: z.number().finite().nullable().optional(),
  accuracyMeters: z.number().finite().nonnegative(),
});

export const LiveActivitySchema = z.object({
  id: z.string().uuid(),
  sport: ActivityTypeSchema,
  startedAt: z.string().datetime(),
  status: LiveActivityStatusSchema,
  canShare: z.boolean(),
  elapsedSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  lastSequence: z.number().int().nonnegative(),
  lastPointAt: z.string().datetime().nullable(),
  lastReceivedAt: z.string().datetime().nullable(),
  route: z.array(z.tuple([z.number(), z.number()])),
});

export const LiveActivityCreateSchema = z.object({
  clientSessionId: z.string().uuid(),
  sport: ActivityTypeSchema,
  startedAt: z.string().datetime(),
});

export const LiveActivityListSchema = z.array(LiveActivitySchema);

export const LiveActivityPointsSchema = z
  .object({
    points: z.array(LivePointSchema).min(1).max(100),
    elapsedSeconds: z.number().int().nonnegative(),
    distanceMeters: z.number().nonnegative(),
  })
  .refine((value) => new Set(value.points.map((point) => point.sequence)).size === value.points.length, {
    message: 'Every point sequence must be unique within a batch',
  });

export const LiveActivityStateSchema = z.object({
  status: LiveActivityStatusSchema.exclude(['discarded']),
  elapsedSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().nonnegative(),
});

export const LiveActivityShareSchema = z.object({
  token: z.string().min(20),
  expiresAt: z.string().datetime(),
});

export const LiveActivityAckSchema = z.object({
  id: z.string().uuid(),
  lastSequence: z.number().int().nonnegative(),
});

export type LiveActivityDto = z.output<typeof LiveActivitySchema>;
export type LiveActivityCreateDto = z.output<typeof LiveActivityCreateSchema>;
export type LiveActivityListDto = z.output<typeof LiveActivityListSchema>;
export type LiveActivityPointsDto = z.output<typeof LiveActivityPointsSchema>;
export type LiveActivityStateDto = z.output<typeof LiveActivityStateSchema>;
export type LiveActivityShareDto = z.output<typeof LiveActivityShareSchema>;
export type LiveActivityAckDto = z.output<typeof LiveActivityAckSchema>;
