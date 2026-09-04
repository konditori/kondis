import { z } from '@hono/zod-openapi';

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

export type PersonDto = z.output<typeof PersonSchema>;
export type PeopleListDto = z.output<typeof PeopleListSchema>;
export type RequestDto = z.output<typeof RequestSchema>;
export type RequestListDto = z.output<typeof RequestListSchema>;
export type RequestDirectionDto = z.output<typeof RequestDirectionQuerySchema>;
export type CommentDto = z.output<typeof CommentSchema>;
export type CommentListDto = z.output<typeof CommentListSchema>;
export type CommentCreateDto = z.output<typeof CommentCreateSchema>;
export type CommentUpdateDto = z.output<typeof CommentUpdateSchema>;
export type LikeStateDto = z.output<typeof LikeStateSchema>;
export type LikerListDto = z.output<typeof LikerListSchema>;
export type NotificationListDto = z.output<typeof NotificationListSchema>;
export type NotificationsReadDto = z.output<typeof NotificationsReadSchema>;
