export const PETMANAGER_MEDIA_BUCKET = "petmanager-media";
export const PETMANAGER_MEDIA_SIGNED_READ_SECONDS = 10 * 60;
export const PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES = 2 * 1024 * 1024;
export const PETMANAGER_MEDIA_TARGET_IMAGE_BYTES = 250 * 1024;
export const PETMANAGER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES = 500 * 1024;
export const PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS = 30;
export const PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES = 150 * 1024 * 1024;
export const PETMANAGER_MEDIA_USAGE_APPROACHING_RATIO = 0.8;
export const PETMANAGER_MEDIA_VARIANT_PROFILES = {
  thumbnail: {
    maxLongEdge: 360,
    targetBytes: 60 * 1024,
    maxBytes: 160 * 1024,
    outputType: "image/webp",
  },
  preview: {
    maxLongEdge: 1280,
    targetBytes: 180 * 1024,
    maxBytes: 700 * 1024,
    outputType: "image/webp",
  },
  optimized: {
    maxLongEdge: 1600,
    targetBytes: PETMANAGER_MEDIA_TARGET_IMAGE_BYTES,
    maxBytes: PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
    outputType: "image/webp",
  },
  provider_ready: {
    maxLongEdge: 1280,
    targetBytes: PETMANAGER_MEDIA_TARGET_IMAGE_BYTES,
    maxBytes: 800 * 1024,
    outputType: "image/webp",
  },
} as const;

export type PetmanagerMediaUsageStatus = "normal" | "approaching" | "exceeded";
export type PetmanagerMediaEnforcementMode = "off" | "warn" | "block";

export type PetmanagerMediaLimitPolicy = {
  softLimitBytes: number;
  hardLimitBytes: number | null;
  transientRetentionDays: number;
  allowOriginalArchive: boolean;
  enforcementMode: PetmanagerMediaEnforcementMode;
};

export const PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY: PetmanagerMediaLimitPolicy = {
  softLimitBytes: PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES,
  hardLimitBytes: null,
  transientRetentionDays: PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS,
  allowOriginalArchive: false,
  enforcementMode: "warn",
};

export function getPetmanagerMediaUsageStatus(params: {
  uploadedBytes: number;
  softLimitBytes?: number;
}): PetmanagerMediaUsageStatus {
  const softLimitBytes = params.softLimitBytes ?? PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES;
  if (softLimitBytes <= 0) return "normal";

  const ratio = params.uploadedBytes / softLimitBytes;
  if (ratio >= 1) return "exceeded";
  if (ratio >= PETMANAGER_MEDIA_USAGE_APPROACHING_RATIO) return "approaching";
  return "normal";
}

export function evaluatePetmanagerMediaUploadLimit(params: {
  projectedUploadedBytes: number;
  policy?: PetmanagerMediaLimitPolicy;
}) {
  const policy = params.policy ?? PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY;
  const status = getPetmanagerMediaUsageStatus({
    uploadedBytes: params.projectedUploadedBytes,
    softLimitBytes: policy.softLimitBytes,
  });
  const hardLimitExceeded =
    policy.hardLimitBytes !== null && params.projectedUploadedBytes > policy.hardLimitBytes;
  const blocked = policy.enforcementMode === "block" && hardLimitExceeded;

  return {
    status,
    blocked,
    hardLimitExceeded,
    softLimitExceeded: status === "exceeded",
    projectedUploadedBytes: params.projectedUploadedBytes,
    softLimitBytes: policy.softLimitBytes,
    hardLimitBytes: policy.hardLimitBytes,
    enforcementMode: policy.enforcementMode,
  };
}

export function formatPetmanagerMediaBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0MB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 10) return `${Math.round(mb)}MB`;
  return `${Math.round(mb * 10) / 10}MB`;
}

export const PETMANAGER_MEDIA_NOTICE_COPY = {
  uploadNotice:
    "전송용 사진은 30일 동안만 보관돼요. 오래 보관해야 하는 사진은 미용기록에 저장해 주세요.",
  uploadNoticeShort: "전송용 사진은 30일 후 자동 정리돼요.",
  compression:
    "사진은 모바일 확인에 적합한 크기로 자동 최적화돼요. 원본보다 용량은 줄지만, 고객이 휴대폰으로 확인하기에는 충분한 품질을 유지합니다.",
  usageApproaching:
    "이번 달 사진 사용량이 많아지고 있어요. 전송용 사진은 자동 압축되며, 30일 후 자동 정리됩니다.",
  usageExceeded:
    "이번 달 사진 사용량이 권장 기준을 넘었어요. 사진 전송은 계속 가능하지만, 장기 보관은 미용기록 저장 사진 위주로 관리해 주세요.",
  policySummary: "전송용 사진: 30일 보관 / 미용기록 저장 사진: 계속 보관 / 원본 사진: 기본 보관 안 함",
} as const;
