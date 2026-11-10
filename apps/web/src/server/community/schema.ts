import { z } from "zod";

const uuid = z.string().uuid();
const target = { targetType: z.enum(["post", "comment"]), targetId: uuid };
const post = {
  id: uuid, category: z.enum(["operations", "knowledge", "lounge", "feedback"]),
  title: z.string().trim().min(1).max(100), body: z.string().trim().min(1).max(10000),
  retainedMediaIds: z.array(uuid).max(3).default([]),
};
export const communityMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_post"), ...post }),
  z.object({ action: z.literal("update_post"), ...post, expectedUpdatedAt: z.iso.datetime({ offset: true }) }),
  z.object({ action: z.literal("delete_post"), id: uuid }),
  z.object({ action: z.literal("create_comment"), id: uuid, postId: uuid, body: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("delete_comment"), id: uuid }),
  z.object({ action: z.literal("report"), ...target, reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("block"), ...target }),
  z.object({ action: z.literal("unblock"), id: uuid }),
  z.object({ action: z.literal("profile"), nickname: z.string().trim().min(2).max(24) }),
]);
export const communityReadSchema = z.object({
  shopId: z.string().trim().min(1).max(100), postId: uuid.optional(),
  q: z.string().trim().max(100).default(""),
  category: z.enum(["", "operations", "knowledge", "lounge", "feedback"]).default(""),
  page: z.coerce.number().int().min(0).max(10000).default(0),
});
export type CommunityMutation = z.infer<typeof communityMutationSchema>;
