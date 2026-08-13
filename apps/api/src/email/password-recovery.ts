import { sendTransactionalEmail } from "./brevo.js";
import {
  renderGooglePasswordGuidanceEmail,
  renderPasswordChangedEmail,
  renderPasswordResetCodeEmail,
} from "./templates.js";

export async function sendPasswordResetCodeEmail(input: {
  email: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}) {
  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Reset your Finance Manager password",
    tag: "password-reset-code",
    textContent: `Hi ${input.name},\n\nUse this code to reset your Finance Manager password: ${input.code}\n\nThe code expires in ${input.expiresInMinutes} minutes\nIf you did not request this, you can ignore this email`,
    htmlContent: renderPasswordResetCodeEmail({
      name: input.name,
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
    }),
  });
}

export async function sendGooglePasswordGuidanceEmail(input: {
  email: string;
  name: string;
}) {
  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Use Google to access Finance Manager",
    tag: "password-reset-google-guidance",
    textContent: `Hi ${input.name},\n\nYour Finance Manager account uses Google sign-in and does not have a password to reset\nOpen Finance Manager, tap Continue with Google, and choose ${input.email}\n\nIf you did not request this, you can ignore this email`,
    htmlContent: renderGooglePasswordGuidanceEmail({
      email: input.email,
      name: input.name,
    }),
  });
}

export async function sendPasswordChangedEmail(input: {
  email: string;
  name: string;
}) {
  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Your Finance Manager password was changed",
    tag: "password-reset-complete",
    textContent: `Hi ${input.name},\n\nYour Finance Manager password was changed and all existing sessions were signed out\nIf this was not you, secure your email account and contact support`,
    htmlContent: renderPasswordChangedEmail({ name: input.name }),
  });
}
