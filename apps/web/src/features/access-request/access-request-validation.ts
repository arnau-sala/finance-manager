import { z } from "zod";

import { emailSchema } from "../auth/email-validation";
import { userNameSchema } from "../auth/user-name-validation";

export const accessRequestSchema = z
  .object({
    email: emailSchema,
    name: userNameSchema,
    message: z
      .string()
      .trim()
      .max(1000, "Message must be 1,000 characters or fewer.")
  })
  .strict();

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
export type AccessRequestField = keyof AccessRequestInput;

export function validateAccessRequest(input: AccessRequestInput) {
  return accessRequestSchema.safeParse(input);
}
