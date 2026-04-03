import { randomInt, randomUUID } from "node:crypto";

import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";

import {
  buildOwnerAuthEmail,
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import { ownerPasswordResetSchema } from "@/lib/auth/owner-password-reset";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import { computeAvailableSlots } from "@/lib/availability";
import { env, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { phoneNormalize, nowIso } from "@/lib/utils";
import { getOwnerRouteAccess, ensureEntityBelongsToOwnerShop } from "@/server/owner-auth";
import {
  createAppointment,
  createCustomerBookingLead,
  createGuardian,
  createPet,
  getBootstrap,
  submitLandingFeedback,
  submitLandingInterest,
  updateAppointmentStatus,
  updateCustomerAppointment,
  updateCustomerPageSettings,
  updateGuardianNotificationSettings,
  updatePet,
  updateRecord,
  updateShopSettings,
  upsertService,
} from "@/server/repositories/app-repository";
import { sendNotification } from "@/server/notifications";
import { getMockStore, setMockStore } from "@/server/mock-store";

const requestVerificationSchema = z.object({
  name: z.string().trim().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
});

const verifyIdentitySchema = z.object({
  name: z.string().trim().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
  code: z.string().length(6),
});

const signupSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
  name: z.string().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
  identityVerificationToken: z.string().min(1),
  shopName: z.string().min(1),
  shopAddress: z.string().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean(),
    marketing: z.boolean(),
  }),
});

type IdentityChallenge = {
  name: string;
  birthDate: string;
  phoneNumber: string;
  code: string;
  expiresAt: number;
};

type VerifiedIdentity = {
  name: string;
  birthDate: string;
  phoneNumber: string;
  verifiedAt: string;
  expiresAt: number;
};

const identityChallenges = new Map<string, IdentityChallenge>();
const verifiedIdentities = new Map<string, VerifiedIdentity>();
const verificationExpiresMs = 1000 * 60 * 5;
const verifiedIdentityExpiresMs = 1000 * 60 * 10;

function normalizeOwnerPhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidOwnerPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizeOwnerPhoneNumber(value));
}

function buildIdentityKey(name: string, birthDate: string, phoneNumber: string) {
  return `${name.trim()}::${birthDate}::${normalizeOwnerPhoneNumber(phoneNumber)}`;
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("허용되지 않은 Origin입니다."));
    },
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
  }),
);
app.use(express.json());

function sendError(response: Response, status: number, message: string) {
  return response.status(status).json({ message });
}

app.get("/api/bootstrap", async (request, response) => {
  try {
    const scope = typeof request.query.scope === "string" ? request.query.scope : "owner";

    if (scope === "public") {
      const shopId = typeof request.query.shopId === "string" ? request.query.shopId : undefined;
      const data = await getBootstrap(shopId);
      return response.json({
        mode: data.mode,
        shop: data.shop,
        services: data.services.filter((item) => item.is_active),
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }

    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const data = await getBootstrap(access.context.shopId);
    return response.json(data);
  } catch (error) {
    return sendError(response, 500, error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
  }
});

app.get("/api/availability", async (request, response) => {
  try {
    const shopId = typeof request.query.shopId === "string" ? request.query.shopId : undefined;
    const date = typeof request.query.date === "string" ? request.query.date : null;
    const serviceId = typeof request.query.serviceId === "string" ? request.query.serviceId : null;
    const excludeAppointmentId =
      typeof request.query.excludeAppointmentId === "string" ? request.query.excludeAppointmentId : undefined;

    if (!date || !serviceId) {
      return sendError(response, 400, "날짜와 서비스를 함께 보내 주세요.");
    }

    const data = await getBootstrap(shopId);
    const slots = computeAvailableSlots({
      date,
      serviceId,
      shop: data.shop,
      services: data.services,
      appointments: data.appointments,
      excludeAppointmentId,
    });

    return response.json({ date, serviceId, slots });
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "예약 가능 시간을 불러오지 못했습니다.");
  }
});

app.get("/api/customer-lookup", async (request, response) => {
  try {
    const shopId = typeof request.query.shopId === "string" ? request.query.shopId : undefined;
    const phone = phoneNormalize(typeof request.query.phone === "string" ? request.query.phone : "");
    const data = await getBootstrap(shopId);
    const guardians = data.guardians.filter((item) => phoneNormalize(item.phone) === phone);
    const guardianIds = new Set(guardians.map((item) => item.id));
    const pets = data.pets.filter((item) => guardianIds.has(item.guardian_id));
    const petIds = new Set(pets.map((item) => item.id));
    const appointments = data.appointments.filter((item) => petIds.has(item.pet_id));
    const groomingRecords = data.groomingRecords.filter((item) => petIds.has(item.pet_id));
    return response.json({ guardians, pets, appointments, groomingRecords });
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "조회에 실패했습니다.");
  }
});

app.patch("/api/customer-appointments", async (request, response) => {
  try {
    const result = await updateCustomerAppointment(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "예약을 처리하지 못했습니다.");
  }
});

app.post("/api/appointments", async (request, response) => {
  try {
    const body = request.body;

    if (body.guardianName || body.source !== "owner") {
      const result = body.guardianName ? await createCustomerBookingLead(body) : await createAppointment(body);
      return response.json(result);
    }

    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await createAppointment({
      ...body,
      shopId: access.context.shopId,
      source: "owner",
    });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "예약을 저장하지 못했습니다.");
  }
});

app.patch("/api/appointments", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "appointment", request.body.appointmentId);
    if (!allowed) {
      return sendError(response, 403, "다른 매장 예약은 수정할 수 없습니다.");
    }

    const result = await updateAppointmentStatus(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "예약 상태를 바꾸지 못했습니다.");
  }
});

app.post("/api/guardians", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await createGuardian({ ...request.body, shopId: access.context.shopId });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "고객을 저장하지 못했습니다.");
  }
});

app.patch("/api/guardians", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "guardian", request.body.guardianId);
    if (!allowed) {
      return sendError(response, 403, "다른 매장 고객은 수정할 수 없습니다.");
    }

    const result = await updateGuardianNotificationSettings(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "고객 알림 설정을 저장하지 못했습니다.");
  }
});

app.post("/api/pets", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await createPet({ ...request.body, shopId: access.context.shopId });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "반려견을 저장하지 못했습니다.");
  }
});

app.patch("/api/pets", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "pet", request.body.petId);
    if (!allowed) {
      return sendError(response, 403, "다른 매장 반려견은 수정할 수 없습니다.");
    }

    const result = await updatePet(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "반려견 정보를 저장하지 못했습니다.");
  }
});

app.post("/api/services", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await upsertService({ ...request.body, shopId: access.context.shopId });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "서비스를 저장하지 못했습니다.");
  }
});

app.patch("/api/records", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "record", request.body.recordId);
    if (!allowed) {
      return sendError(response, 403, "다른 매장 기록은 수정할 수 없습니다.");
    }

    const result = await updateRecord(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "미용 기록을 저장하지 못했습니다.");
  }
});

app.patch("/api/settings", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await updateShopSettings({ ...request.body, shopId: access.context.shopId });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
  }
});

app.patch("/api/customer-page-settings", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const result = await updateCustomerPageSettings({ ...request.body, shopId: access.context.shopId });
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "고객 화면 설정을 저장하지 못했습니다.");
  }
});

app.post("/api/notifications", async (request, response) => {
  try {
    const access = await getOwnerRouteAccess(request);
    if (!access.ok) {
      return sendError(response, access.status, access.message);
    }

    const body = request.body;
    const notice = await sendNotification({
      shop_id: access.context.shopId,
      appointment_id: body.appointmentId || null,
      pet_id: body.petId || null,
      guardian_id: body.guardianId || null,
      type: body.type,
      channel: "mock",
      message: body.message,
      status: "mocked",
      sent_at: null,
    });

    if (!hasSupabaseEnv()) {
      const store = getMockStore();
      store.notifications = [notice, ...store.notifications];
      setMockStore(store);
      return response.json(notice);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error("Supabase 연결이 없습니다.");
    }

    const payload = { ...notice, id: randomUUID() };
    const insertResult = await supabase.from("notifications").insert(payload);
    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    return response.json(payload);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "알림을 저장하지 못했습니다.");
  }
});

app.get("/api/auth/check-login-id", async (request, response) => {
  try {
    if (!hasSupabaseAdminEnv()) {
      return response.status(503).json({
        available: false,
        message:
          "Supabase ?? ??? ???? ?????. SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY? ??? ???.",
      });
    }

    const loginId = normalizeOwnerLoginId(typeof request.query.loginId === "string" ? request.query.loginId : "");
    if (!loginId) {
      return response.status(400).json({ available: false, message: "???? ??? ???." });
    }

    if (!isValidOwnerLoginId(loginId)) {
      return response
        .status(400)
        .json({ available: false, message: "???? ?? ???, ??, ., -, _ ???? 4? ?? ??? ???." });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return sendError(response, 503, "Supabase ??? ??? ? ????.");
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (duplicate.error) {
      return response.status(400).json({ available: false, message: "??? ?? ? ??? ??????." });
    }

    if (duplicate.data?.login_id) {
      return response.json({ available: false, message: "?? ?? ?? ??????." });
    }

    return response.json({ available: true, message: "?? ??? ??????." });
  } catch (error) {
    return response
      .status(400)
      .json({ available: false, message: error instanceof Error ? error.message : "??? ?? ? ??? ??????." });
  }
});

app.post("/api/auth/request-verification-code", async (request, response) => {
  try {
    const payload = requestVerificationSchema.parse({
      ...request.body,
      phoneNumber: normalizeOwnerPhoneNumber(request.body?.phoneNumber ?? ""),
    });

    if (!isValidBirthDate8(payload.birthDate)) {
      return sendError(response, 400, "????? 8?? ??? ??? ???.");
    }

    if (!isValidOwnerPhoneNumber(payload.phoneNumber)) {
      return sendError(response, 400, "??? ??? ???? ??? ???.");
    }

    const code = String(randomInt(100000, 1000000));
    const key = buildIdentityKey(payload.name, payload.birthDate, payload.phoneNumber);

    identityChallenges.set(key, {
      name: payload.name.trim(),
      birthDate: payload.birthDate,
      phoneNumber: normalizeOwnerPhoneNumber(payload.phoneNumber),
      code,
      expiresAt: Date.now() + verificationExpiresMs,
    });

    return response.json({
      success: true,
      devVerificationCode: code,
      message: "?? ???? ????? ???? ??? ???.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(response, 400, "???? ??? ?? ??? ???.");
    }

    return sendError(response, 400, error instanceof Error ? error.message : "???? ?? ? ??? ??????.");
  }
});

app.post("/api/auth/verify-identity", async (request, response) => {
  try {
    const payload = verifyIdentitySchema.parse({
      ...request.body,
      phoneNumber: normalizeOwnerPhoneNumber(request.body?.phoneNumber ?? ""),
      code: String(request.body?.code ?? "").replace(/\D/g, "").slice(0, 6),
    });

    if (!isValidBirthDate8(payload.birthDate)) {
      return sendError(response, 400, "????? 8?? ??? ??? ???.");
    }

    if (!isValidOwnerPhoneNumber(payload.phoneNumber)) {
      return sendError(response, 400, "??? ??? ???? ??? ???.");
    }

    const key = buildIdentityKey(payload.name, payload.birthDate, payload.phoneNumber);
    const challenge = identityChallenges.get(key);

    if (!challenge || challenge.expiresAt < Date.now()) {
      identityChallenges.delete(key);
      return sendError(response, 400, "????? ???????. ?? ??? ???.");
    }

    if (challenge.code !== payload.code) {
      return sendError(response, 400, "????? ???? ????.");
    }

    identityChallenges.delete(key);

    const verificationToken = randomUUID();
    const verifiedAt = nowIso();

    verifiedIdentities.set(verificationToken, {
      name: challenge.name,
      birthDate: challenge.birthDate,
      phoneNumber: challenge.phoneNumber,
      verifiedAt,
      expiresAt: Date.now() + verifiedIdentityExpiresMs,
    });

    return response.json({
      success: true,
      verificationToken,
      message: "????? ???????.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(response, 400, "???? ??? ?? ??? ???.");
    }

    return sendError(response, 400, error instanceof Error ? error.message : "???? ? ??? ??????.");
  }
});

app.post("/api/auth/signup", async (request, response) => {
  try {
    if (!hasSupabaseAdminEnv()) {
      return sendError(
        response,
        503,
        "Supabase ?? ??? ???? ?????. SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY? ??? ???.",
      );
    }

    const payload = signupSchema.parse({
      ...request.body,
      phoneNumber: normalizeOwnerPhoneNumber(request.body?.phoneNumber ?? ""),
    });
    const loginId = normalizeOwnerLoginId(payload.loginId);

    if (!isValidOwnerLoginId(loginId)) {
      return sendError(response, 400, "???? ?? ???, ??, ., -, _ ???? 4? ?? ??? ???.");
    }

    if (!isValidOwnerPassword(payload.password)) {
      return sendError(response, 400, ownerPasswordRuleMessage);
    }

    if (payload.password != payload.passwordConfirm) {
      return sendError(response, 400, "???? ??? ???? ????.");
    }

    if (!isValidBirthDate8(payload.birthDate)) {
      return sendError(response, 400, "????? 8?? ??? ??? ???.");
    }

    if (!isValidOwnerPhoneNumber(payload.phoneNumber)) {
      return sendError(response, 400, "??? ??? ???? ??? ???.");
    }

    if (!payload.agreements.service || !payload.agreements.privacy) {
      return sendError(response, 400, "?? ??? ??????.");
    }

    const verifiedIdentity = verifiedIdentities.get(payload.identityVerificationToken);
    if (!verifiedIdentity || verifiedIdentity.expiresAt < Date.now()) {
      verifiedIdentities.delete(payload.identityVerificationToken);
      return sendError(response, 400, "????? ?? ??? ???.");
    }

    if (
      verifiedIdentity.name !== payload.name.trim() ||
      verifiedIdentity.birthDate !== payload.birthDate ||
      verifiedIdentity.phoneNumber !== normalizeOwnerPhoneNumber(payload.phoneNumber)
    ) {
      return sendError(response, 400, "???? ??? ?? ??? ???? ????.");
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return sendError(response, 503, "Supabase ??? ??? ? ????.");
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (duplicate.data?.login_id) {
      return sendError(response, 409, "?? ?? ?? ??????.");
    }

    const authEmail = buildOwnerAuthEmail(loginId);
    const createdUser = await supabase.auth.admin.createUser({
      email: authEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        login_id: loginId,
        name: payload.name,
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      const message = createdUser.error?.message || "???? ??? ??????.";
      return sendError(response, message.includes("already") ? 409 : 400, message.includes("already") ? "?? ?? ?? ??????." : message);
    }

    const user = createdUser.data.user;
    const shopId = `shop-${randomUUID().slice(0, 8)}`;
    const now = nowIso();

    const shopInsert = await supabase.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: payload.phoneNumber,
      address: payload.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      approval_mode: "manual",
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      await supabase.auth.admin.deleteUser(user.id);
      return sendError(response, 400, "?? ??? ???? ?????.");
    }

    const agreementPayload = {
      agreed_at: now,
      terms_version: OWNER_SIGNUP_TERMS_VERSION,
      agreements: payload.agreements,
    };

    const profileInsert = await supabase.from("owner_profiles").upsert(
      {
        user_id: user.id,
        shop_id: shopId,
        login_id: loginId,
        name: payload.name,
        birth_date: payload.birthDate,
        phone_number: payload.phoneNumber,
        identity_verified_at: verifiedIdentity.verifiedAt,
        agreements: agreementPayload,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (profileInsert.error) {
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      const message = profileInsert.error.code === "23505" ? "?? ?? ?? ??????." : "?? ??? ???? ?????.";
      return sendError(response, profileInsert.error.code === "23505" ? 409 : 400, message);
    }

    verifiedIdentities.delete(payload.identityVerificationToken);

    return response.json({
      success: true,
      requiresEmailConfirmation: false,
      message: "????? ???????.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(response, 400, "???? ??? ?? ??? ???.");
    }

    return sendError(response, 400, error instanceof Error ? error.message : "???? ??? ??????.");
  }
});

app.post("/api/auth/reset-password", async (request, response) => {
  try {
    if (!hasSupabaseEnv()) {
      return sendError(response, 503, "Supabase ?? ??? ???? ?????.");
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return sendError(response, 503, "Supabase ??? ??? ? ????.");
    }

    const payload = ownerPasswordResetSchema.parse(request.body);
    const profileResult = await supabase
      .from("owner_profiles")
      .select("user_id, name, birth_date")
      .eq("login_id", payload.loginId)
      .maybeSingle();

    if (profileResult.error) {
      return sendError(response, 400, "?? ??? ???? ? ??? ??????.");
    }

    const profile = profileResult.data;
    if (!profile || profile.name.trim() !== payload.name || profile.birth_date !== payload.birthDate) {
      return sendError(response, 404, "??? ??? ???? ??? ?? ?????.");
    }

    const updated = await supabase.auth.admin.updateUserById(profile.user_id, {
      password: payload.password,
    });

    if (updated.error) {
      return sendError(response, 400, updated.error.message || "????? ???? ?????.");
    }

    return response.json({
      success: true,
      message: "????? ???????. ??? ???? ?? ???? ???.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(response, 400, error.issues[0]?.message || "???? ?? ??? ???.");
    }

    return sendError(response, 400, error instanceof Error ? error.message : "???? ?? ? ??? ??????.");
  }
});

app.post("/api/landing/interest", async (request, response) => {
  try {
    const result = await submitLandingInterest(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "신청을 저장하지 못했습니다.");
  }
});

app.post("/api/landing/feedback", async (request, response) => {
  try {
    const result = await submitLandingFeedback(request.body);
    return response.json(result);
  } catch (error) {
    return sendError(response, 400, error instanceof Error ? error.message : "피드백을 저장하지 못했습니다.");
  }
});

app.listen(env.port, () => {
  console.log(`${env.appName} listening on http://localhost:${env.port}`);
});
