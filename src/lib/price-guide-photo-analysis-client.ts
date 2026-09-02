export async function cleanupLatePhotoAnalysisResult(
  mediaAssetIds: string[],
  cleanupUploadedAssets: (mediaAssetIds: string[]) => Promise<void>,
) {
  await cleanupUploadedAssets(mediaAssetIds);
}
