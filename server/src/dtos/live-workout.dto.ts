import { z } from '@hono/zod-openapi';

import { ActivityTypeSchema } from 'src/dtos/activity.dto';

const LiveWorkoutStatusSchema = z.enum(['recording', 'paused', 'ended', 'discarded']);
const LivePointSchema = z.object({
  sequence: z.number().int().positive(),
  recordedAt: z.string().datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  altitude: z.number().finite().nullable().optional(),
  accuracyMeters: z.number().finite().nonnegative(),
});

export const LiveWorkoutSchema = z.object({
  id: z.string().uuid(),
  sport: ActivityTypeSchema,
  startedAt: z.string().datetime(),
  status: LiveWorkoutStatusSchema,
  canShare: z.boolean(),
  elapsedSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  lastSequence: z.number().int().nonnegative(),
  lastPointAt: z.string().datetime().nullable(),
  lastReceivedAt: z.string().datetime().nullable(),
  route: z.array(z.tuple([z.number(), z.number()])),
});

export const LiveWorkoutCreateSchema = z.object({
  clientSessionId: z.string().uuid(),
  sport: ActivityTypeSchema,
  startedAt: z.string().datetime(),
});

export const LiveWorkoutListSchema = z.array(LiveWorkoutSchema);

export const LiveWorkoutPointsSchema = z
  .object({
    points: z.array(LivePointSchema).min(1).max(100),
    elapsedSeconds: z.number().int().nonnegative(),
    distanceMeters: z.number().nonnegative(),
  })
  .refine((value) => new Set(value.points.map((point) => point.sequence)).size === value.points.length, {
    message: 'Every point sequence must be unique within a batch',
  });

export const LiveWorkoutStateSchema = z.object({
  status: LiveWorkoutStatusSchema.exclude(['discarded']),
  elapsedSeconds: z.number().int().nonnegative(),
  distanceMeters: z.number().nonnegative(),
});

export const LiveWorkoutShareSchema = z.object({
  token: z.string().min(20),
  expiresAt: z.string().datetime(),
});

export const LiveWorkoutAckSchema = z.object({
  id: z.string().uuid(),
  lastSequence: z.number().int().nonnegative(),
});

export type LiveWorkoutDto = z.output<typeof LiveWorkoutSchema>;
export type LiveWorkoutCreateDto = z.output<typeof LiveWorkoutCreateSchema>;
export type LiveWorkoutListDto = z.output<typeof LiveWorkoutListSchema>;
export type LiveWorkoutPointsDto = z.output<typeof LiveWorkoutPointsSchema>;
export type LiveWorkoutStateDto = z.output<typeof LiveWorkoutStateSchema>;
export type LiveWorkoutShareDto = z.output<typeof LiveWorkoutShareSchema>;
export type LiveWorkoutAckDto = z.output<typeof LiveWorkoutAckSchema>;
