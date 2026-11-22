export const COMMUNITY_CATEGORIES = {
  operations: "운영 질문", knowledge: "노하우", lounge: "자유 소통", feedback: "건의",
} as const;
export type CommunityCategory = keyof typeof COMMUNITY_CATEGORIES;
export type CommunityImage = { mediaAssetId: string; url: string };
export type CommunityPost = {
  id: string; category: CommunityCategory; title: string; body: string;
  authorName: string; isMine: boolean; createdAt: string; updatedAt: string;
  commentCount: number; images: CommunityImage[];
  likeCount: number; liked: boolean; saved: boolean;
};
export type CommunityReaction = Pick<CommunityPost, "id" | "likeCount" | "liked" | "saved">;
export type CommunityReactionAction = "like" | "save";
export type CommunityCommentVote = -1 | 0 | 1;
export type CommunityCommentReaction = { id: string; score: number; vote: CommunityCommentVote };
export type CommunityMutationResult = { id?: string; success?: boolean; reaction?: CommunityReaction; commentReaction?: CommunityCommentReaction };
export type CommunityComment = {
  id: string; body: string; authorName: string; isMine: boolean; createdAt: string;
  parentId: string | null; isPostAuthor: boolean; unavailable: boolean;
  score: number; vote: CommunityCommentVote;
};
export type CommunityResponse = {
  viewer: { nickname: string };
  posts?: CommunityPost[]; post?: CommunityPost; comments?: CommunityComment[];
  page: number; hasMore: boolean;
  blockedUsers: { id: string; nickname: string }[];
};
export type CommunityApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export type CommunityResource = {
  id: string; title: string; body: string; sourceUrl: string; closesOn: string | null;
  closed: boolean; published: boolean; createdAt: string; updatedAt: string;
};
export type CommunityResourcesResponse = {
  resources: CommunityResource[]; page: number; hasMore: boolean; canPublish?: boolean;
};
export const COMMUNITY_RULES = "다른 이용자를 존중해 주세요. 고객의 이름·전화번호·예약 내역은 게시하지 마세요. 사진은 직접 촬영했거나 공유 권한이 있는 자료만 첨부해 주세요.";
