import { z } from "zod";

import { emailSchema } from "./email-validation";
import { accountPasswordSchema } from "./password-validation";
import { userNameSchema } from "./user-name-validation";

export const registrationSchema = z
  .object({
    email: emailSchema,
    name: userNameSchema,
    password: accountPasswordSchema,
    passwordConfirmation: z.string().min(1, "Repeat your password.")
  })
  .strict()
  .superRefine(({ password, passwordConfirmation }, context) => {
    if (password !== passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "Passwords do not match."
      });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type RegistrationField = keyof RegistrationInput;

export function validateRegistration(input: RegistrationInput) {
  return registrationSchema.safeParse(input);
}
