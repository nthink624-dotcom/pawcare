import { z } from "zod";

import {
  isValidOwnerEmail,
  isValidOwnerPassword,
  normalizeOwnerEmail,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";

export const ownerPasswordResetSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "이메일을 입력해 주세요.")
      .transform((value) => normalizeOwnerEmail(value))
      .refine((value) => isValidOwnerEmail(value), {
        message: "올바른 이메일 주소를 입력해 주세요.",
      }),
    name: z.string().trim().optional().default(""),
    birthDate: z.string().trim().optional().default(""),
    phoneNumber: z.string().trim().optional().default(""),
    identityVerificationToken: z.string().trim().min(1, "본인 인증을 먼저 완료해 주세요."),
    password: z.string().refine((value) => isValidOwnerPassword(value), {
      message: ownerPasswordRuleMessage,
    }),
    passwordConfirm: z.string().min(6, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호 확인이 일치하지 않습니다.",
  });

export type OwnerPasswordResetInput = z.input<typeof ownerPasswordResetSchema>;
