import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AdminAccount = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  loginId: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminAccountRow = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  login_id: string;
  password_hash: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AdminAccountRowWithPassword = AdminAccountRow;

type DatabaseErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export class AdminAccountError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function hasMissingAdminAccountsTableError(error: DatabaseErrorLike | null | undefined) {
  const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || (haystack.includes("admin_accounts") && haystack.includes("schema cache"));
}

function toAdminAccountInfraError(error: DatabaseErrorLike) {
  if (hasMissingAdminAccountsTableError(error)) {
    return new AdminAccountError(
      "관리자 테이블이 아직 만들어지지 않았어요. Supabase SQL 편집기에서 admin_accounts 마이그레이션을 먼저 실행해 주세요.",
      503,
    );
  }

  return new AdminAccountError(error.message || "관리자 정보를 불러오는 중 문제가 발생했습니다.", 500);
}

function mapAdminAccount(row: AdminAccountRow): AdminAccount {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    loginId: row.login_id,
    isSuperAdmin: row.is_super_admin,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyAdminPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const derivedHash = scryptSync(password, salt, 64).toString("hex");
  const left = Buffer.from(derivedHash, "hex");
  const right = Buffer.from(expectedHash, "hex");

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function hasAnyAdminAccount() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminAccountError("관리자 정보를 확인할 수 없습니다.", 503);
  }

  const result = await admin.from("admin_accounts").select("id", { count: "exact", head: true });
  if (result.error) {
    throw toAdminAccountInfraError(result.error);
  }

  return (result.count ?? 0) > 0;
}

export async function getAdminAccountByLoginId(loginId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminAccountError("관리자 정보를 확인할 수 없습니다.", 503);
  }

  const result = await admin
    .from("admin_accounts")
    .select("id, full_name, email, phone_number, login_id, password_hash, is_super_admin, is_active, created_at, updated_at")
    .eq("login_id", normalizeLoginId(loginId))
    .maybeSingle();

  if (result.error) {
    throw toAdminAccountInfraError(result.error);
  }

  return (result.data as AdminAccountRowWithPassword | null) ?? null;
}

export async function getAdminAccountById(adminId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminAccountError("관리자 정보를 확인할 수 없습니다.", 503);
  }

  const result = await admin
    .from("admin_accounts")
    .select("id, full_name, email, phone_number, login_id, password_hash, is_super_admin, is_active, created_at, updated_at")
    .eq("id", adminId)
    .maybeSingle();

  if (result.error) {
    throw toAdminAccountInfraError(result.error);
  }

  return result.data ? mapAdminAccount(result.data as AdminAccountRow) : null;
}

export async function createInitialAdminAccount(input: {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  loginId: string;
  password: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminAccountError("관리자 정보를 확인할 수 없습니다.", 503);
  }

  const alreadyExists = await hasAnyAdminAccount();
  if (alreadyExists) {
    throw new AdminAccountError("이미 등록된 관리자 계정이 있습니다. 관리자 로그인으로 진행해 주세요.", 409);
  }

  const payload = {
    full_name: input.fullName.trim(),
    email: normalizeEmail(input.email),
    phone_number: input.phoneNumber?.trim() || null,
    login_id: normalizeLoginId(input.loginId),
    password_hash: hashAdminPassword(input.password),
    is_super_admin: true,
    is_active: true,
  };

  const result = await admin
    .from("admin_accounts")
    .insert(payload)
    .select("id, full_name, email, phone_number, login_id, password_hash, is_super_admin, is_active, created_at, updated_at")
    .single();

  if (result.error) {
    throw toAdminAccountInfraError(result.error);
  }

  return mapAdminAccount(result.data as AdminAccountRow);
}

export async function resetAdminPassword(input: {
  loginId: string;
  password: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminAccountError("관리자 정보를 확인할 수 없습니다.", 503);
  }

  const account = await getAdminAccountByLoginId(input.loginId);
  if (!account) {
    throw new AdminAccountError("일치하는 관리자 계정을 찾을 수 없습니다.", 404);
  }

  const result = await admin
    .from("admin_accounts")
    .update({
      password_hash: hashAdminPassword(input.password),
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    .select("id, full_name, email, phone_number, login_id, password_hash, is_super_admin, is_active, created_at, updated_at")
    .single();

  if (result.error) {
    throw toAdminAccountInfraError(result.error);
  }

  return mapAdminAccount(result.data as AdminAccountRow);
}
