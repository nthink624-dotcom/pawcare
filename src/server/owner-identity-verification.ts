import { randomUUID } from "node:crypto";

import { getSupabaseServerRuntimeStage } from "@/lib/server-env";
import {
  createIdentityVerificationCode,
  hashIdentityVerificationCode,
  identityVerificationPurposeSchema,
  issueVerifiedIdentityToken,
  readVerifiedIdentityToken,
  type IdentityVerificationPurpose,
} from "@/lib/auth/owner-identity";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const CHALLENGE_EXPIRES_IN_MS = 1000 * 60 * 5;
const VERIFIED_EXPIRES_IN_MS = 1000 * 60 * 10;

type IdentityVerificationRow = {
  id: string;
  purpose: IdentityVerificationPurpose;
  verification_method: "local" | "portone";
  status: "requested" | "verified" | "consumed" | "failed";
  name: string;
  birth_date: string;
  phone_number: string;
  challenge_code_hash: string | null;
  challenge_expires_at: string | null;
  verification_attempt_count: number;
  verification_token_id: string | null;
  verified_at: string | null;
  verified_expires_at: string | null;
  consumed_at: string | null;
  provider_identity_verification_id: string | null;
  provider_status: string | null;
  provider_customer_id: string | null;
  provider_customer_name: string | null;
  provider_customer_phone_number: string | null;
  provider_customer_birth_date: string | null;
  ci: string | null;
  di: string | null;
};

type ProviderCustomer = {
  id?: string;
  name?: string;
  phoneNumber?: string;
  birthDate?: string;
  ci?: string;
  di?: string;
};

type PortoneIdentityResponse = {
  status?: string;
  customer?: ProviderCustomer;
};

function nowIso() {
  return new Date().toISOString();
}

function addMs(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeBirthDate(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function mapRow(data: Record<string, unknown>): IdentityVerificationRow {
  const parsedPurpose = identityVerificationPurposeSchema.parse(data.purpose);
  return {
    id: String(data.id),
    purpose: parsedPurpose,
    verification_method: data.verification_method === "portone" ? "portone" : "local",
    status:
      data.status === "verified" || data.status === "consumed" || data.status === "failed"
        ? data.status
        : "requested",
    name: String(data.name),
    birth_date: String(data.birth_date),
    phone_number: String(data.phone_number),
    challenge_code_hash: typeof data.challenge_code_hash === "string" ? data.challenge_code_hash : null,
    challenge_expires_at: typeof data.challenge_expires_at === "string" ? data.challenge_expires_at : null,
    verification_attempt_count: typeof data.verification_attempt_count === "number" ? data.verification_attempt_count : 0,
    verification_token_id: typeof data.verification_token_id === "string" ? data.verification_token_id : null,
    verified_at: typeof data.verified_at === "string" ? data.verified_at : null,
    verified_expires_at: typeof data.verified_expires_at === "string" ? data.verified_expires_at : null,
    consumed_at: typeof data.consumed_at === "string" ? data.consumed_at : null,
    provider_identity_verification_id:
      typeof data.provider_identity_verification_id === "string" ? data.provider_identity_verification_id : null,
    provider_status: typeof data.provider_status === "string" ? data.provider_status : null,
    provider_customer_id: typeof data.provider_customer_id === "string" ? data.provider_customer_id : null,
    provider_customer_name: typeof data.provider_customer_name === "string" ? data.provider_customer_name : null,
    provider_customer_phone_number:
      typeof data.provider_customer_phone_number === "string" ? data.provider_customer_phone_number : null,
    provider_customer_birth_date:
      typeof data.provider_customer_birth_date === "string" ? data.provider_customer_birth_date : null,
    ci: typeof data.ci === "string" ? data.ci : null,
    di: typeof data.di === "string" ? data.di : null,
  };
}

function getSupabaseOrThrow() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase 관리자 클라이언트를 만들 수 없습니다.");
  }
  return supabase;
}

function mapProviderCustomer(raw: Record<string, unknown>): ProviderCustomer {
  const birthDate =
    typeof raw.birthDate === "string"
      ? normalizeBirthDate(raw.birthDate)
      : typeof raw.birthYear === "string" &&
          typeof raw.birthMonth === "string" &&
          typeof raw.birthDay === "string"
        ? normalizeBirthDate(`${raw.birthYear}${raw.birthMonth}${raw.birthDay}`)
        : undefined;

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    name: typeof raw.name === "string" ? raw.name.trim() : undefined,
    phoneNumber: typeof raw.phoneNumber === "string" ? normalizePhoneNumber(raw.phoneNumber) : undefined,
    birthDate,
    ci: typeof raw.ci === "string" ? raw.ci : undefined,
    di: typeof raw.di === "string" ? raw.di : undefined,
  };
}

function extractProviderCustomer(identityVerification: Record<string, unknown> | undefined): ProviderCustomer | null {
  if (!identityVerification) return null;

  const verifiedCustomer = identityVerification.verifiedCustomer;
  if (verifiedCustomer && typeof verifiedCustomer === "object" && !Array.isArray(verifiedCustomer)) {
    return mapProviderCustomer(verifiedCustomer as Record<string, unknown>);
  }

  const customer = identityVerification.customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    return mapProviderCustomer(customer as Record<string, unknown>);
  }

  return null;
}

export async function createLocalIdentityVerificationRequest(input: {
  purpose: IdentityVerificationPurpose;
  name: string;
  birthDate: string;
  phoneNumber: string;
}) {
  const supabase = getSupabaseOrThrow();
  const code = createIdentityVerificationCode();
  const id = randomUUID();
  const createdAt = nowIso();
  const challengeExpiresAt = addMs(CHALLENGE_EXPIRES_IN_MS);

  const { error } = await supabase.from("owner_identity_verifications").insert({
    id,
    purpose: input.purpose,
    verification_method: "local",
    status: "requested",
    name: input.name.trim(),
    birth_date: normalizeBirthDate(input.birthDate),
    phone_number: normalizePhoneNumber(input.phoneNumber),
    challenge_code_hash: hashIdentityVerificationCode(code),
    challenge_expires_at: challengeExpiresAt,
    created_at: createdAt,
    updated_at: createdAt,
  });

  if (error) {
    throw new Error(error.message || "본인인증 요청을 저장하지 못했습니다.");
  }

  return {
    verificationRequestId: id,
    devVerificationCode: getSupabaseServerRuntimeStage() === "development" ? code : null,
  };
}

export async function createProviderIdentityVerificationRequest(input: {
  purpose: IdentityVerificationPurpose;
  name: string;
  birthDate: string;
  phoneNumber: string;
}) {
  const supabase = getSupabaseOrThrow();
  const id = randomUUID();
  const createdAt = nowIso();

  const { error } = await supabase.from("owner_identity_verifications").insert({
    id,
    purpose: input.purpose,
    verification_method: "portone",
    status: "requested",
    name: input.name.trim(),
    birth_date: normalizeBirthDate(input.birthDate),
    phone_number: normalizePhoneNumber(input.phoneNumber),
    created_at: createdAt,
    updated_at: createdAt,
  });

  if (error) {
    throw new Error(error.message || "본인인증 요청을 저장하지 못했습니다.");
  }

  return { verificationRequestId: id };
}

async function getVerificationRow(id: string) {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase
    .from("owner_identity_verifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "본인인증 상태를 확인하지 못했습니다.");
  }

  if (!data) {
    return null;
  }

  return mapRow(data);
}

export async function completeLocalIdentityVerification(input: {
  verificationRequestId: string;
  purpose: IdentityVerificationPurpose;
  name: string;
  birthDate: string;
  phoneNumber: string;
  code: string;
}) {
  const supabase = getSupabaseOrThrow();
  const row = await getVerificationRow(input.verificationRequestId);

  if (!row) {
    return { ok: false as const, message: "본인인증 요청을 찾지 못했습니다." };
  }

  if (row.purpose !== input.purpose || row.verification_method !== "local") {
    return { ok: false as const, message: "본인인증 요청 정보가 올바르지 않습니다." };
  }

  if (row.status !== "requested" || !row.challenge_code_hash || !row.challenge_expires_at) {
    return { ok: false as const, message: "이미 사용된 인증 요청입니다. 다시 인증해 주세요." };
  }

  if (new Date(row.challenge_expires_at).getTime() < Date.now()) {
    await supabase
      .from("owner_identity_verifications")
      .update({
        status: "failed",
        failure_reason: "challenge_expired",
        updated_at: nowIso(),
      })
      .eq("id", row.id)
      .eq("status", "requested");
    return { ok: false as const, message: "인증 요청이 만료되었어요. 다시 인증해 주세요." };
  }

  if (
    row.name !== input.name.trim() ||
    row.birth_date !== normalizeBirthDate(input.birthDate) ||
    row.phone_number !== normalizePhoneNumber(input.phoneNumber)
  ) {
    return { ok: false as const, message: "입력한 정보와 인증 요청 정보가 일치하지 않습니다." };
  }

  const codeHash = hashIdentityVerificationCode(input.code);
  if (row.challenge_code_hash !== codeHash) {
    await supabase
      .from("owner_identity_verifications")
      .update({
        verification_attempt_count: row.verification_attempt_count + 1,
        updated_at: nowIso(),
      })
      .eq("id", row.id)
      .eq("status", "requested");
    return { ok: false as const, message: "인증번호를 다시 확인해 주세요." };
  }

  const verificationTokenId = randomUUID();
  const verifiedAt = nowIso();
  const verifiedExpiresAt = addMs(VERIFIED_EXPIRES_IN_MS);
  const { error } = await supabase
    .from("owner_identity_verifications")
    .update({
      status: "verified",
      challenge_code_hash: null,
      verified_at: verifiedAt,
      verified_expires_at: verifiedExpiresAt,
      verification_token_id: verificationTokenId,
      updated_at: verifiedAt,
      failure_reason: null,
    })
    .eq("id", row.id)
    .eq("status", "requested");

  if (error) {
    throw new Error(error.message || "본인인증 상태를 저장하지 못했습니다.");
  }

  return {
    ok: true as const,
    verificationToken: issueVerifiedIdentityToken({
      verificationId: row.id,
      tokenId: verificationTokenId,
      purpose: row.purpose,
      source: "local",
      expiresInMs: VERIFIED_EXPIRES_IN_MS,
    }),
  };
}

export async function completePortoneIdentityVerification(input: {
  verificationRequestId: string;
  purpose: IdentityVerificationPurpose;
  identityVerificationId: string;
  identityVerification: Record<string, unknown> | undefined;
}) {
  const supabase = getSupabaseOrThrow();
  const row = await getVerificationRow(input.verificationRequestId);

  if (!row) {
    return { ok: false as const, message: "본인인증 요청을 찾지 못했습니다." };
  }

  if (row.purpose !== input.purpose || row.verification_method !== "portone") {
    return { ok: false as const, message: "본인인증 요청 정보가 올바르지 않습니다." };
  }

  if (row.status !== "requested") {
    return { ok: false as const, message: "이미 사용된 인증 요청입니다. 다시 인증해 주세요." };
  }

  const providerStatus =
    typeof input.identityVerification?.status === "string" ? input.identityVerification.status : undefined;

  if (providerStatus !== "VERIFIED") {
    return { ok: false as const, message: "본인확인 결과를 서버에서 확인하지 못했습니다. 다시 인증해 주세요." };
  }

  const providerCustomer = extractProviderCustomer(input.identityVerification);
  if (!providerCustomer?.name || !providerCustomer.phoneNumber || !providerCustomer.birthDate) {
    await supabase
      .from("owner_identity_verifications")
      .update({
        failure_reason: "provider_customer_missing_required_fields",
        updated_at: nowIso(),
      })
      .eq("id", row.id)
      .eq("status", "requested");

    return {
      ok: false as const,
      message: "본인확인 결과의 고객 정보가 충분하지 않습니다. 다시 인증해 주세요.",
    };
  }

  if (providerCustomer?.name && providerCustomer.name !== row.name) {
    return { ok: false as const, message: "본인확인 결과의 이름 정보가 일치하지 않습니다." };
  }

  if (providerCustomer?.phoneNumber && providerCustomer.phoneNumber !== row.phone_number) {
    return { ok: false as const, message: "본인확인 결과의 휴대폰번호가 일치하지 않습니다." };
  }

  if (providerCustomer?.birthDate && providerCustomer.birthDate !== row.birth_date) {
    return { ok: false as const, message: "본인확인 결과의 생년월일이 일치하지 않습니다." };
  }

  const verificationTokenId = randomUUID();
  const verifiedAt = nowIso();
  const verifiedExpiresAt = addMs(VERIFIED_EXPIRES_IN_MS);
  const { error } = await supabase
    .from("owner_identity_verifications")
    .update({
      status: "verified",
      provider_identity_verification_id: input.identityVerificationId,
      provider_status: providerStatus,
      provider_customer_id: providerCustomer?.id ?? null,
      provider_customer_name: providerCustomer?.name ?? null,
      provider_customer_phone_number: providerCustomer?.phoneNumber ?? null,
      provider_customer_birth_date: providerCustomer?.birthDate ?? null,
      ci: providerCustomer?.ci ?? null,
      di: providerCustomer?.di ?? null,
      verified_at: verifiedAt,
      verified_expires_at: verifiedExpiresAt,
      verification_token_id: verificationTokenId,
      updated_at: verifiedAt,
      failure_reason: null,
    })
    .eq("id", row.id)
    .eq("status", "requested");

  if (error) {
    throw new Error(error.message || "본인인증 상태를 저장하지 못했습니다.");
  }

  return {
    ok: true as const,
    verificationToken: issueVerifiedIdentityToken({
      verificationId: row.id,
      tokenId: verificationTokenId,
      purpose: row.purpose,
      source: "portone",
      expiresInMs: VERIFIED_EXPIRES_IN_MS,
    }),
  };
}

export async function getVerifiedIdentityForToken(input: {
  verificationToken: string;
  purpose: IdentityVerificationPurpose;
  expectedName: string;
  expectedBirthDate: string;
  expectedPhoneNumber: string;
}) {
  const token = readVerifiedIdentityToken(input.verificationToken);
  if (!token || token.purpose !== input.purpose) {
    return null;
  }

  const row = await getVerificationRow(token.verificationId);
  if (!row) {
    return null;
  }

  if (
    row.status !== "verified" ||
    row.consumed_at ||
    !row.verified_expires_at ||
    row.verification_token_id !== token.tokenId ||
    new Date(row.verified_expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  if (
    token.source === "portone" &&
    (!row.provider_customer_name || !row.provider_customer_phone_number || !row.provider_customer_birth_date)
  ) {
    return null;
  }

  if (
    row.name !== input.expectedName.trim() ||
    row.birth_date !== normalizeBirthDate(input.expectedBirthDate) ||
    row.phone_number !== normalizePhoneNumber(input.expectedPhoneNumber)
  ) {
    return null;
  }

  if (
    token.source === "portone" &&
    (row.provider_customer_name !== row.name ||
      row.provider_customer_phone_number !== row.phone_number ||
      row.provider_customer_birth_date !== row.birth_date)
  ) {
    return null;
  }

  return {
    ...row,
    tokenId: token.tokenId,
  };
}

export async function consumeVerifiedIdentity(input: {
  verificationId: string;
  tokenId: string;
  action: "signup" | "reset-password" | "find-login-id";
}) {
  const supabase = getSupabaseOrThrow();
  const consumedAt = nowIso();

  const { data, error } = await supabase
    .from("owner_identity_verifications")
    .update({
      status: "consumed",
      consumed_at: consumedAt,
      consumed_action: input.action,
      updated_at: consumedAt,
    })
    .eq("id", input.verificationId)
    .eq("status", "verified")
    .eq("verification_token_id", input.tokenId)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "본인인증 사용 상태를 저장하지 못했습니다.");
  }

  return Boolean(data?.id);
}
