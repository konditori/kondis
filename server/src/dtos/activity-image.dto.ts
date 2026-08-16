import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ActivityImageSchema = z
  .object({
    id: z.string().uuid(),
    caption: z.string().nullable(),
    sortOrder: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    status: z.enum(['pending', 'ready', 'failed']),
    thumbnail: z.string().nullable(),
    preview: z.string().nullable(),
    original: z.string().nullable(),
  })
  .meta({ id: 'ActivityImageDto' });

export const ActivityImageUpdateSchema = z
  .object({
    caption: z.string().trim().max(10_000).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export class ActivityImageDto extends createZodDto(ActivityImageSchema) {}
export class ActivityImageListDto extends createZodDto(z.array(ActivityImageSchema)) {}
export class ActivityImageUpdateDto extends createZodDto(ActivityImageUpdateSchema) {}
