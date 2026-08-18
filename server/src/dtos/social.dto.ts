import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const SocialUserSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
});
export const RelationSchema = z.object({
  following: z.boolean(),
  incomingRequest: z.boolean(),
  outgoingRequest: z.boolean(),
  blockedByViewer: z.boolean(),
  blockedViewer: z.boolean(),
});
export const PersonSchema = z.object({ user: SocialUserSchema, relation: RelationSchema });
export const RequestSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  user: SocialUserSchema,
});
export const RequestDirectionSchema = z.enum(['incoming', 'outgoing']).default('incoming');
export const CommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: SocialUserSchema,
});
export const CommentListSchema = z.object({ comments: z.array(CommentSchema), nextCursor: z.string().nullable() });
export const CommentCreateSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const CommentUpdateSchema = CommentCreateSchema;
export const LikeStateSchema = z.object({ liked: z.boolean(), likeCount: z.number().int().nonnegative() });

export class PersonDto extends createZodDto(PersonSchema) {}
export class PeopleListDto extends createZodDto(z.array(PersonSchema)) {}
export class RequestDto extends createZodDto(RequestSchema) {}
export class RequestListDto extends createZodDto(z.array(RequestSchema)) {}
export class RequestDirectionDto extends createZodDto(z.object({ direction: RequestDirectionSchema })) {}
export class CommentDto extends createZodDto(CommentSchema) {}
export class CommentListDto extends createZodDto(CommentListSchema) {}
export class CommentCreateDto extends createZodDto(CommentCreateSchema) {}
export class CommentUpdateDto extends createZodDto(CommentUpdateSchema) {}
export class LikeStateDto extends createZodDto(LikeStateSchema) {}
