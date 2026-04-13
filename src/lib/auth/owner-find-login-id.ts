import { z } from "zod";

import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export const ownerFindLoginIdSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  birthDate: z.string().trim().refine((value) => isValidBirthDate8(value), {
    message: "생년월일은 8자리 숫자로 입력해 주세요.",
  }),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => normalizePhoneNumber(value))
    .refine((value) => /^01\d{8,9}$/.test(value), {
      message: "휴대폰 번호를 올바르게 입력해 주세요.",
    }),
});

export type OwnerFindLoginIdInput = z.input<typeof ownerFindLoginIdSchema>;
