import { sendTransactionalEmail } from "./brevo.js";
import { renderRegistrationVerificationEmail } from "./templates.js";

export async function sendRegistrationVerificationEmail(input: {
  email: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}) {
  await sendTransactionalEmail({
    to: {
      email: input.email,
      name: input.name,
    },
    subject: "Verify your Finance Manager account",
    tag: "registration-verification",
    htmlContent: renderRegistrationVerificationEmail({
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
    }),
  });
}
