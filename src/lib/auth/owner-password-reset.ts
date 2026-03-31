import { z } from "zod";

import { isValidBirthDate8, isValidOwnerLoginId, normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";

export const ownerPasswordResetSchema = z
  .object({
    loginId: z
      .string()
      .trim()
      .min(1, "아이디를 입력해 주세요.")
      .transform((value) => normalizeOwnerLoginId(value))
      .refine((value) => isValidOwnerLoginId(value), {
        message: "아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요.",
      }),
    name: z.string().trim().min(1, "이름을 입력해 주세요."),
    birthDate: z.string().trim().refine((value) => isValidBirthDate8(value), {
      message: "생년월일은 8자리 숫자로 입력해 주세요.",
    }),
    password: z.string().min(6, "비밀번호는 6자 이상 입력해 주세요."),
    passwordConfirm: z.string().min(6, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호 확인이 일치하지 않습니다.",
  });

export type OwnerPasswordResetInput = z.input<typeof ownerPasswordResetSchema>;
