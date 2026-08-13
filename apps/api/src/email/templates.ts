export function escapeEmailHtml(value: string) {
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

export function renderFinanceManagerEmailFrame(content: string) {
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

export function renderRegistrationVerificationEmail(input: {
  code: string;
  expiresInMinutes: number;
}) {
  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Verify your email</h1>
        <p style="margin:0 0 24px;color:#667085;line-height:1.5;">Enter this code within ${input.expiresInMinutes} minutes to finish creating your account<br>If you did not request it, you can ignore this email</p>
        <p style="margin:0;font-size:32px;letter-spacing:8px;color:#111827;">${escapeEmailHtml(input.code)}</p>`);
}

export function renderPasswordResetCodeEmail(input: {
  name: string;
  code: string;
  expiresInMinutes: number;
}) {
  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Reset your password</h1>
        <p style="margin:0 0 8px;color:#667085;line-height:1.5;">Hi ${escapeEmailHtml(input.name)}, enter this code in Finance Manager:</p>
        <p style="margin:22px 0;font-size:32px;letter-spacing:8px;color:#111827;">${escapeEmailHtml(input.code)}</p>
        <p style="margin:0;color:#667085;line-height:1.5;">The code expires in ${input.expiresInMinutes} minutes<br>If you did not request this, you can ignore this email</p>`);
}

export function renderGooglePasswordGuidanceEmail(input: {
  email: string;
  name: string;
}) {
  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Sign in with Google</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Hi ${escapeEmailHtml(input.name)}, this account uses Google sign-in and does not have a password to reset</p>
        <div style="margin:24px 0;padding:13px 18px;color:#111827;background:#e7f6f3;border:1px solid #9fd8ce;border-radius:999px;text-align:center;font-size:16px;">
          <span style="display:inline-block;margin-right:10px;font-weight:600;color:#4285f4;">G</span>
          Continue with Google
        </div>
        <p style="margin:0;color:#667085;line-height:1.5;">Open Finance Manager, tap the button shown above, then choose <strong style="color:#111827;">${escapeEmailHtml(input.email)}</strong></p>
        <p style="margin:16px 0 0;color:#667085;line-height:1.5;">If you did not request this, you can ignore this email</p>`);
}

export function renderPasswordChangedEmail(input: { name: string }) {
  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Password changed</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Hi ${escapeEmailHtml(input.name)}, your Finance Manager password was changed and all existing sessions were signed out</p>
        <p style="margin:16px 0 0;color:#667085;line-height:1.5;">If this was not you, secure your email account and contact support</p>`);
}

export function renderAccountEmailVerificationEmail(input: {
  username: string | null;
  code: string;
  expiresInMinutes: number;
}) {
  const message = input.username
    ? `The account @${escapeEmailHtml(input.username)} wants to link this email<br>Enter this code within ${input.expiresInMinutes} minutes to confirm it`
    : `Your Finance Manager account wants to enable email sign-in<br>Enter this code within ${input.expiresInMinutes} minutes to confirm it`;

  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Verify your email</h1>
        <p style="margin:0 0 24px;color:#667085;line-height:1.5;">${message}<br>If you did not request it, you can ignore this email</p>
        <p style="margin:0;font-size:32px;letter-spacing:8px;color:#111827;">${escapeEmailHtml(input.code)}</p>`);
}

export function renderAccountEmailUnlinkVerificationEmail(input: {
  code: string;
  expiresInMinutes: number;
}) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#ffffff;border:1px solid #d9dee7;border-radius:8px;padding:32px;">
        <p style="margin:0 0 18px;font-size:20px;color:#dc2626;">Finance Manager</p>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Confirm email removal</h1>
        <p style="margin:0 0 24px;color:#667085;line-height:1.5;">Enter this code within ${input.expiresInMinutes} minutes to remove email sign-in from your Finance Manager account<br>If you did not request this change, do not share the code and you can safely ignore this email</p>
        <p style="margin:0;font-size:32px;letter-spacing:8px;color:#111827;">${escapeEmailHtml(input.code)}</p>
      </div>
    </div>
  </body>
</html>`;
}

export function renderEmailLinkConflictNoticeEmail() {
  return renderFinanceManagerEmailFrame(`
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:500;">Email already linked</h1>
        <p style="margin:0;color:#667085;line-height:1.5;">Someone tried to link another Finance Manager account to this email address, but this email already belongs to an existing account<br>No changes were made<br>If this was you, sign in to the account that already uses this email</p>`);
}
