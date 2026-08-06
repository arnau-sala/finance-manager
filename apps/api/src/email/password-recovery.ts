import { sendTransactionalEmail } from "./brevo.js";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}

function emailFrame(content: string) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;padding:32px;">
        <p style="margin:0 0 18px;font-size:20px;color:#0f766e;">Finance Manager</p>
        ${content}
      </div>
    </div>
  </body>
</html>`;
}

export async function sendPasswordResetCodeEmail(input: {
  email: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}) {
  const name = escapeHtml(input.name);
  const code = escapeHtml(input.code);

  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Reset your Finance Manager password",
    tag: "password-reset-code",
    textContent: `Hi ${input.name},\n\nUse this code to reset your Finance Manager password: ${input.code}\n\nThe code expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    htmlContent: emailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Reset your password</h1>
        <p style="margin:0 0 8px;color:#667085;line-height:1.5;">Hi ${name}, enter this code in Finance Manager:</p>
        <p style="margin:22px 0;font-size:32px;letter-spacing:8px;color:#111827;">${code}</p>
        <p style="margin:0;color:#667085;line-height:1.5;">The code expires in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`),
  });
}

export async function sendGooglePasswordGuidanceEmail(input: {
  email: string;
  name: string;
}) {
  const name = escapeHtml(input.name);

  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Use Google to access Finance Manager",
    tag: "password-reset-google-guidance",
    textContent: `Hi ${input.name},\n\nYour Finance Manager account uses Google sign-in and does not have a password to reset. Open Finance Manager, tap Continue with Google, and choose ${input.email}.\n\nIf you did not request this, you can ignore this email.`,
    htmlContent: emailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Sign in with Google</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Hi ${name}, this account uses Google sign-in and does not have a password to reset.</p>
        <div style="margin:24px 0;padding:13px 18px;color:#111827;background:#e7f6f3;border:1px solid #9fd8ce;border-radius:999px;text-align:center;font-size:16px;">
          <span style="display:inline-block;margin-right:10px;font-weight:600;color:#4285f4;">G</span>
          Continue with Google
        </div>
        <p style="margin:0;color:#667085;line-height:1.5;">Open Finance Manager, tap the button shown above, then choose <strong style="color:#111827;">${escapeHtml(input.email)}</strong>.</p>
        <p style="margin:16px 0 0;color:#667085;line-height:1.5;">If you did not request this, you can ignore this email.</p>`),
  });
}

export async function sendPasswordChangedEmail(input: {
  email: string;
  name: string;
}) {
  const name = escapeHtml(input.name);

  await sendTransactionalEmail({
    to: { email: input.email, name: input.name },
    subject: "Your Finance Manager password was changed",
    tag: "password-reset-complete",
    textContent: `Hi ${input.name},\n\nYour Finance Manager password was changed and all existing sessions were signed out. If this was not you, secure your email account and contact support.`,
    htmlContent: emailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Password changed</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Hi ${name}, your Finance Manager password was changed and all existing sessions were signed out.</p>
        <p style="margin:16px 0 0;color:#667085;line-height:1.5;">If this was not you, secure your email account and contact support.</p>`),
  });
}
