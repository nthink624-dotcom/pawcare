/** Re-encode selected photos to remove metadata and fit the shared API body limit. */
export async function prepareCommunityPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) {
    throw new Error("JPG·PNG·WebP 사진을 15MB 이하로 선택해 주세요.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 준비하지 못했습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("사진을 준비하지 못했습니다.")), "image/webp", 0.8,
    ));
    if (blob.size > 950 * 1024) throw new Error("사진 크기가 큽니다. 더 작은 사진을 선택해 주세요.");
    return new File([blob], "community.webp", { type: blob.type });
  } finally { URL.revokeObjectURL(url); }
}
