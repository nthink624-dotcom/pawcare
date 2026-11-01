import { fetchApiJsonWithAuth } from "@/lib/api";
import type { GroomingRecord, MediaAsset } from "@/types/domain";

export function scopeGroomingRecords(records: GroomingRecord[], shopId: string, petId: string | null | undefined) {
  if (!petId) return [];
  return records.filter(record => record.shop_id === shopId && record.pet_id === petId)
    .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at) || b.id.localeCompare(a.id));
}

export async function readGroomingHistory(shopId: string, petId: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ shopId, petId });
  const response = await fetchApiJsonWithAuth<{ records: GroomingRecord[]; total: number }>(`/api/owner/grooming-records?${params}`, { cache: "no-store", signal });
  const records = scopeGroomingRecords(response.records, shopId, petId);
  if (records.length !== response.records.length) throw new Error("기록의 매장과 반려동물 정보를 확인하지 못했습니다.");
  return { records, total: response.total };
}

export async function readGroomingPhotos(shopId: string, petId: string, recordId: string, signal?: AbortSignal) {
  const photos: MediaAsset[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ shopId, petId, groomingRecordId: recordId, includeVariants: "false", limit: "200" });
    if (cursor) params.set("beforeCreatedAt", cursor);
    const response = await fetchApiJsonWithAuth<{ items: Array<{ mediaAsset: MediaAsset }>; page: { hasMore: boolean; nextBeforeCreatedAt: string | null } }>(`/api/owner/media/assets?${params}`, { cache: "no-store", signal });
    for (const { mediaAsset: asset } of response.items) {
      if (asset.shop_id !== shopId || asset.pet_id !== petId || asset.grooming_record_id !== recordId) throw new Error("사진의 기록 연결 정보를 확인하지 못했습니다.");
      if (asset.content_type.startsWith("image/") && asset.status === "ready" && !asset.deleted_at && !photos.some(photo => photo.id === asset.id)) photos.push(asset);
    }
    if (!response.page.hasMore) break;
    const next = response.page.nextBeforeCreatedAt;
    if (!next || next === cursor) throw new Error("사진 목록을 끝까지 불러오지 못했습니다.");
    cursor = next;
  } while (true);
  const result: Array<{ asset: MediaAsset; url: string }> = [];
  for (let offset = 0; offset < photos.length; offset += 200) {
    const batch = photos.slice(offset, offset + 200);
    const signed = await fetchApiJsonWithAuth<{ items: Array<{ mediaAssetId: string; signedUrl: string }> }>("/api/owner/media/signed-urls", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ shopId, mediaAssetIds: batch.map(asset => asset.id), variant: "preview" }),
    });
    for (const asset of batch) {
      const url = signed.items.find(item => item.mediaAssetId === asset.id)?.signedUrl;
      if (!url) throw new Error("등록된 사진을 불러오지 못했습니다. 다시 시도해 주세요.");
      result.push({ asset, url });
    }
  }
  return result;
}
