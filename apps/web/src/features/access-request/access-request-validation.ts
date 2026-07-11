import { z } from "zod";

import { emailSchema } from "../auth/email-validation";

export const accessRequestSchema = z
  .object({
    email: emailSchema,
    name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(100, "Name must be 100 characters or fewer."),
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
