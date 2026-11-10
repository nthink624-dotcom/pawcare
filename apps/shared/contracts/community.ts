export const COMMUNITY_CATEGORIES = {
  operations: "운영 질문", knowledge: "노하우", lounge: "자유 소통", feedback: "건의",
} as const;
export type CommunityCategory = keyof typeof COMMUNITY_CATEGORIES;
export type CommunityImage = { mediaAssetId: string; url: string };
export type CommunityPost = {
  id: string; category: CommunityCategory; title: string; body: string;
  authorName: string; isMine: boolean; createdAt: string; updatedAt: string;
  commentCount: number; images: CommunityImage[];
};
export type CommunityComment = {
  id: string; body: string; authorName: string; isMine: boolean; createdAt: string;
};
export type CommunityResponse = {
  viewer: { nickname: string };
  posts?: CommunityPost[]; post?: CommunityPost; comments?: CommunityComment[];
  page: number; hasMore: boolean;
  blockedUsers: { id: string; nickname: string }[];
};
export type CommunityApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export const COMMUNITY_RULES = "다른 이용자를 존중해 주세요. 고객의 이름·전화번호·예약 내역은 게시하지 마세요. 사진은 직접 촬영했거나 공유 권한이 있는 자료만 첨부해 주세요.";
