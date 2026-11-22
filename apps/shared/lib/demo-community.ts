import type {
  CommunityApi, CommunityCategory, CommunityComment, CommunityCommentVote,
  CommunityMutationResult, CommunityPost, CommunityResource, CommunityResourcesResponse, CommunityResponse,
} from "../contracts/community";

type DemoMutation =
  | { action: "like" | "save"; postId: string; active: boolean }
  | { action: "create_post" | "update_post"; id: string; title: string; body: string; category: CommunityCategory; retainedMediaIds: string[] }
  | { action: "create_comment"; id: string; postId: string; body: string; parentId: string | null }
  | { action: "vote_comment"; postId: string; commentId: string; value: CommunityCommentVote }
  | { action: "delete_post" | "delete_comment" | "unblock"; id: string }
  | { action: "block"; targetId: string }
  | { action: "profile"; nickname: string }
  | { action: "report" };

const sampleDate = "2026-11-19T04:00:00.000Z";
const samplePosts: CommunityPost[] = [
  { id: "demo-booking", category: "operations", authorName: "보리살롱", title: "예약 시간 사이에 여유를 얼마나 두세요?", body: "주말에는 상담이 길어질 때가 있어서 예약 사이에 정리 시간을 따로 두고 있어요. 다른 매장은 어떻게 운영하시는지 궁금해요.", isMine: false, createdAt: sampleDate, updatedAt: sampleDate, commentCount: 2, images: [], likeCount: 5, liked: false, saved: false },
  { id: "demo-notes", category: "knowledge", authorName: "모모미용실", title: "다음 방문 때 도움이 된 기록 세 가지", body: "지난번 스타일, 긴장했던 순간, 좋아했던 간식을 짧게 기록해 두니 다시 만났을 때 상담이 한결 편했어요.", isMine: false, createdAt: "2026-11-18T06:00:00.000Z", updatedAt: "2026-11-18T06:00:00.000Z", commentCount: 0, images: [], likeCount: 2, liked: false, saved: true },
];
const sampleComments: CommunityComment[] = [
  { id: "demo-answer", body: "저희는 예약마다 15분씩 비워요. 오전 첫 타임에는 상담 시간을 따로 잡아두고요.", authorName: "모모미용실", isMine: false, createdAt: sampleDate, parentId: null, isPostAuthor: false, unavailable: false, score: 2, vote: 0 },
  { id: "demo-reply", body: "상담 시간을 따로 빼두는 방법도 좋네요. 이번 주말에 해볼게요.", authorName: "보리살롱", isMine: false, createdAt: sampleDate, parentId: "demo-answer", isPostAuthor: true, unavailable: false, score: 0, vote: 0 },
];
const sampleResource: CommunityResource = {
  id: "demo-resource", title: "지원금·운영 소식 예시", body: "모아보기에는 지원사업 공고와 매장 운영에 참고할 소식이 표시됩니다. 이 글은 데모 화면용 예시입니다.",
  sourceUrl: "", closesOn: null, closed: false, published: true, createdAt: sampleDate, updatedAt: sampleDate,
};

function demoPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("사진을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
}

/** Isolated, in-memory demo data. No request in this adapter reaches a server. */
export function createDemoCommunityApi(shopName: string): CommunityApi {
  const posts = new Map(samplePosts.map(post => [post.id, { ...post }]));
  const comments = new Map<string, CommunityComment[]>([["demo-booking", sampleComments.map(comment => ({ ...comment }))]]);
  const blocked = new Set<string>();
  let nickname = shopName;

  const visibleComments = (postId: string) => (comments.get(postId) ?? []).filter(comment => !blocked.has(comment.authorName));
  const postForViewer = (post: CommunityPost) => ({ ...post, commentCount: visibleComments(post.id).filter(comment => !comment.unavailable).length });

  function read(url: URL): CommunityResponse | CommunityResourcesResponse {
    const page = Number(url.searchParams.get("page")) || 0;
    if (url.pathname === "/api/owner/community/resources") return { resources: page === 0 ? [sampleResource] : [], page, hasMore: false };
    const available = Array.from(posts.values()).filter(post => !blocked.has(post.authorName));
    const common = { viewer: { nickname }, blockedUsers: Array.from(blocked, name => ({ id: name, nickname: name })), page, hasMore: false };
    const postId = url.searchParams.get("postId");
    if (postId) {
      const post = available.find(entry => entry.id === postId);
      if (!post) throw new Error("게시글을 찾을 수 없어요.");
      return { ...common, post: postForViewer(post), comments: visibleComments(postId) };
    }
    const savedOnly = url.searchParams.get("savedOnly") === "true";
    const entries = available.filter(post => !savedOnly || post.saved).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ...common, posts: entries.slice(page * 20, (page + 1) * 20).map(postForViewer), hasMore: entries.length > (page + 1) * 20 };
  }

  async function mutate(request: DemoMutation, files: File[]): Promise<CommunityMutationResult> {
    switch (request.action) {
      case "create_post":
      case "update_post": {
        const previous = posts.get(request.id);
        const now = new Date().toISOString();
        const { id, title, body, category, retainedMediaIds } = request;
        const retained = previous?.images.filter(image => retainedMediaIds.includes(image.mediaAssetId)) ?? [];
        const uploaded = await Promise.all(files.map(async file => ({ mediaAssetId: crypto.randomUUID(), url: await demoPhoto(file) })));
        posts.set(id, {
          id, title, body, category, authorName: nickname, isMine: true, updatedAt: now, createdAt: previous?.createdAt ?? now,
          commentCount: previous?.commentCount ?? 0, likeCount: previous?.likeCount ?? 0, liked: previous?.liked ?? false, saved: previous?.saved ?? false,
          images: [...retained, ...uploaded],
        });
        return { id, success: true };
      }
      case "like":
      case "save": {
        const post = posts.get(request.postId);
        if (!post) throw new Error("게시글을 찾을 수 없어요.");
        const { action, active } = request;
        const next = action === "like"
          ? { ...post, liked: active, likeCount: post.likeCount + Number(active) - Number(post.liked) }
          : { ...post, saved: active };
        posts.set(post.id, next);
        return { reaction: { id: next.id, liked: next.liked, saved: next.saved, likeCount: next.likeCount } };
      }
      case "create_comment": {
        const post = posts.get(request.postId);
        if (!post) throw new Error("게시글을 찾을 수 없어요.");
        const { id, body, parentId } = request;
        const thread = comments.get(post.id) ?? [];
        if (parentId && !thread.some(comment => comment.id === parentId)) throw new Error("답글을 달 댓글을 찾을 수 없어요.");
        comments.set(post.id, [...thread, { id, body, parentId, authorName: nickname, isMine: true, createdAt: new Date().toISOString(), isPostAuthor: post.isMine, unavailable: false, score: 0, vote: 0 }]);
        return { id, success: true };
      }
      case "vote_comment": {
        const thread = comments.get(request.postId) ?? [];
        const comment = thread.find(entry => entry.id === request.commentId);
        if (!comment) throw new Error("댓글을 찾을 수 없어요.");
        const reaction = { id: comment.id, vote: request.value, score: comment.score + request.value - comment.vote };
        comments.set(request.postId, thread.map(entry => entry.id === comment.id ? { ...entry, ...reaction } : entry));
        return { commentReaction: reaction };
      }
      case "profile":
        nickname = request.nickname;
        for (const [id, post] of posts) if (post.isMine) posts.set(id, { ...post, authorName: nickname });
        for (const [id, thread] of comments) comments.set(id, thread.map(comment => comment.isMine ? { ...comment, authorName: nickname } : comment));
        break;
      case "delete_post":
        posts.delete(request.id);
        comments.delete(request.id);
        break;
      case "delete_comment":
        for (const [id, thread] of comments) {
          if (!thread.some(comment => comment.id === request.id)) continue;
          const hasReplies = thread.some(comment => comment.parentId === request.id);
          comments.set(id, hasReplies
            ? thread.map(comment => comment.id === request.id ? { ...comment, body: "삭제된 댓글입니다.", unavailable: true } : comment)
            : thread.filter(comment => comment.id !== request.id));
          break;
        }
        break;
      case "block": {
        const author = posts.get(request.targetId) ?? Array.from(comments.values()).flat().find(comment => comment.id === request.targetId);
        if (author && !author.isMine) blocked.add(author.authorName);
        break;
      }
      case "unblock":
        blocked.delete(request.id);
        break;
      case "report":
        throw new Error("데모에서는 신고가 접수되지 않아요.");
      default:
        throw new Error("데모에서 지원하지 않는 요청이에요.");
    }
    return { success: true };
  }

  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const url = new URL(path, "https://demo.invalid");
    if (url.origin !== "https://demo.invalid" || !["/api/owner/community", "/api/owner/community/resources"].includes(url.pathname)) throw new Error("데모에서 지원하지 않는 요청이에요.");
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!init?.method || init.method === "GET") return read(url) as T;
    if (init.method !== "POST" || url.pathname !== "/api/owner/community") throw new Error("데모에서 지원하지 않는 요청이에요.");
    const form = init.body instanceof FormData ? init.body : null;
    const payload = form?.get("payload") ?? init.body;
    if (typeof payload !== "string") throw new Error("입력 내용을 다시 확인해 주세요.");
    return await mutate(JSON.parse(payload) as DemoMutation, form?.getAll("photos").filter((entry): entry is File => entry instanceof File) ?? []) as T;
  };
}
