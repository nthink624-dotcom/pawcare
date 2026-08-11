import { z } from "zod";

export const ownerFindEmailSchema = z.object({
  identityVerificationToken: z.string().trim().min(1, "본인인증을 먼저 완료해 주세요."),
});
