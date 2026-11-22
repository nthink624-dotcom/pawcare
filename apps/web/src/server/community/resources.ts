import { z } from "zod";
import { communityAdmin, communityDatabaseError } from "./service";

const fields = {
  id: z.string().uuid(), title: z.string().trim().min(1).max(100), body: z.string().trim().min(1).max(5000),
  sourceUrl: z.string().trim().max(2000).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }),
  closesOn: z.iso.date().nullable(), published: z.boolean(),
};
export const resourceMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...fields }),
  z.object({ action: z.literal("update"), ...fields, expectedUpdatedAt: z.iso.datetime({ offset: true }) }),
  z.object({ action: z.literal("delete"), id: fields.id, expectedUpdatedAt: z.iso.datetime({ offset: true }) }),
]);
export const resourcePageSchema = z.coerce.number().int().min(0).max(10000).default(0);
export async function readCommunityResources(userId: string, shopId: string, page: number) {
  const { data, error } = await communityAdmin().rpc("community_resource_list", { p_user: userId, p_shop: shopId, p_page: page });
  if (error) communityDatabaseError(error);
  return data;
}
export async function manageCommunityResources(adminId: string, action: string, payload: unknown) {
  const { data, error } = await communityAdmin().rpc("community_resource_admin", { p_admin: adminId, p_action: action, p_payload: payload });
  if (error) communityDatabaseError(error);
  return data;
}
