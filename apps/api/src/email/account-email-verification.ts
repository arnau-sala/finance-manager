import { sendTransactionalEmail } from "./brevo.js";

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
    htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;padding:32px;">
        <p style="margin:0 0 18px;font-size:20px;color:#0f766e;">Finance Manager</p>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Verify your email</h1>
        <p style="margin:0 0 24px;color:#667085;line-height:1.5;">${
          input.username
            ? `The account @${input.username} wants to link this email<br>Enter this code within ${input.expiresInMinutes} minutes to confirm it`
            : `Your Finance Manager account wants to enable email sign-in<br>Enter this code within ${input.expiresInMinutes} minutes to confirm it`
        }<br>If you did not request it, you can ignore this email</p>
        <p style="margin:0;font-size:32px;letter-spacing:8px;color:#111827;">${input.code}</p>
      </div>
    </div>
  </body>
</html>`,
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
    htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;padding:32px;">
        <p style="margin:0 0 18px;font-size:20px;color:#dc2626;">Finance Manager</p>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Confirm email removal</h1>
        <p style="margin:0 0 24px;color:#667085;line-height:1.5;">Enter this code within ${input.expiresInMinutes} minutes to remove email sign-in from your Finance Manager account<br>If you did not request this change, do not share the code and you can safely ignore this email</p>
        <p style="margin:0;font-size:32px;letter-spacing:8px;color:#111827;">${input.code}</p>
      </div>
    </div>
  </body>
</html>`,
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
    htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;padding:32px;">
        <p style="margin:0 0 18px;font-size:20px;color:#0f766e;">Finance Manager</p>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Email already linked</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Someone tried to link another Finance Manager account to this email address, but this email already belongs to an existing account<br>No changes were made<br>If this was you, sign in to the account that already uses this email</p>
      </div>
    </div>
  </body>
</html>`,
  });
}
