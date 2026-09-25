export async function cleanupLatePhotoAnalysisResult<T>(
  cleanupTargets: T[],
  cleanupUploadedAssets: (cleanupTargets: T[]) => Promise<void>,
) {
  await cleanupUploadedAssets(cleanupTargets);
}
