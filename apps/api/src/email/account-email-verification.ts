import { sendTransactionalEmail } from "./brevo.js";
import {
  renderAccountEmailUnlinkVerificationEmail,
  renderAccountEmailVerificationEmail,
  renderEmailLinkConflictNoticeEmail,
} from "./templates.js";

export async function sendAccountEmailVerificationEmail(input: {
  email: string;
  name: string;
  username: string | null;
  code: string;
  expiresInMinutes: number;
}) {
  await sendTransactionalEmail({
    to: {
      email: input.email,
      name: input.name,
    },
    subject: "Link your email to Finance Manager",
    tag: "account-email-verification",
    htmlContent: renderAccountEmailVerificationEmail({
      username: input.username,
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
    }),
  });
}

export async function sendAccountEmailUnlinkVerificationEmail(input: {
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
    subject: "Confirm email removal from Finance Manager",
    tag: "account-email-unlink-verification",
    htmlContent: renderAccountEmailUnlinkVerificationEmail({
      code: input.code,
      expiresInMinutes: input.expiresInMinutes,
    }),
  });
}

export async function sendEmailLinkConflictNotice(input: {
  email: string;
  name: string;
}) {
  await sendTransactionalEmail({
    to: {
      email: input.email,
      name: input.name,
    },
    subject: "Email linking attempt on Finance Manager",
    tag: "account-email-link-conflict",
    htmlContent: renderEmailLinkConflictNoticeEmail(),
  });
}
