import { z } from '@hono/zod-openapi';
import { createZodDto } from 'nestjs-zod';

export const SocialUserSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type SocialUser = z.infer<typeof SocialUserSchema>;

export const ActivityEngagementSchema = z.object({
  activity_id: z.uuid(),
  like_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  viewer_liked: z.boolean().nullable(),
});
export type ActivityEngagement = z.infer<typeof ActivityEngagementSchema>;

export const RelationSchema = z.object({
  following: z.boolean(),
  incomingRequest: z.boolean(),
  outgoingRequest: z.boolean(),
  blockedByViewer: z.boolean(),
  blockedViewer: z.boolean(),
});

export const PersonSchema = z.object({ user: SocialUserSchema, relation: RelationSchema });
export const PeopleListSchema = z.array(PersonSchema);

export const RequestSchema = z.object({
  id: z.uuid(),
  createdAt: z.string().datetime(),
  user: SocialUserSchema,
});

export const RequestDirectionSchema = z.enum(['incoming', 'outgoing']).default('incoming');
export const RequestDirectionQuerySchema = z.object({ direction: RequestDirectionSchema });
export const RequestListSchema = z.array(RequestSchema);

export const CommentSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: SocialUserSchema,
});

export const CommentListSchema = z.object({ comments: z.array(CommentSchema), nextCursor: z.string().nullable() });

export const CommentCreateSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const CommentUpdateSchema = CommentCreateSchema;

export const LikeStateSchema = z.object({ liked: z.boolean(), likeCount: z.number().int().nonnegative() });

export const LikerListSchema = z.array(SocialUserSchema);

export const NotificationSchema = z.object({
  id: z.uuid(),
  type: z.enum(['activity_like', 'activity_comment', 'follow_request']),
  createdAt: z.string().datetime(),
  actor: SocialUserSchema,
  activityId: z.uuid().nullable(),
  activityName: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
});

export const NotificationListSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});

export const NotificationsReadSchema = z.object({ markedRead: z.boolean() });

export class PersonDto extends createZodDto(PersonSchema) {}

export class PeopleListDto extends createZodDto(PeopleListSchema) {}

export class RequestDto extends createZodDto(RequestSchema) {}

export class RequestListDto extends createZodDto(RequestListSchema) {}

export class RequestDirectionDto extends createZodDto(RequestDirectionQuerySchema) {}

export class CommentDto extends createZodDto(CommentSchema) {}

export class CommentListDto extends createZodDto(CommentListSchema) {}

export class CommentCreateDto extends createZodDto(CommentCreateSchema) {}

export class CommentUpdateDto extends createZodDto(CommentUpdateSchema) {}

export class LikeStateDto extends createZodDto(LikeStateSchema) {}

export class LikerListDto extends createZodDto(LikerListSchema) {}

export class NotificationListDto extends createZodDto(NotificationListSchema) {}

export class NotificationsReadDto extends createZodDto(NotificationsReadSchema) {}
