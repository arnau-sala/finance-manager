import { ApiRequestError } from "./auth-api";

type ApiIssue = {
  field?: string;
  message?: string;
};

type ApiErrorResponse = {
  error?: string;
  message?: string;
  retryAfter?: string;
  issues?: ApiIssue[];
};

async function createPasswordRecoveryError(
  response: Response,
  fallback: string
) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    const issue = body.issues?.find(
      (candidate) => typeof candidate.message === "string"
    )?.message;

    return new ApiRequestError(
      issue ?? body.message ?? body.error ?? fallback,
      response.status,
      body.retryAfter ?? null
    );
  } catch {
    return new ApiRequestError(fallback, response.status);
  }
}

async function postPasswordRecovery<T>(
  path: string,
  body: object | undefined,
  fallback: string
) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw await createPasswordRecoveryError(response, fallback);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export function requestPasswordResetEmail(email: string) {
  return postPasswordRecovery(
    "/api/auth/password-reset/email/request",
    { email },
        "Unable to start account recovery\nPlease try again"
  );
}

export function resendPasswordResetEmail(email: string) {
  return postPasswordRecovery(
    "/api/auth/password-reset/email/resend",
    { email },
        "Unable to resend the code\nPlease try again"
  );
}

export function verifyPasswordResetEmailCode(email: string, code: string) {
  return postPasswordRecovery(
    "/api/auth/password-reset/email/verify",
    { email, code },
        "Unable to verify the code\nPlease try again"
  );
}

export async function verifyPasswordResetRecoveryCode(input: {
  username: string | null;
  recoveryCode: string;
}) {
  const body = await postPasswordRecovery<{ username?: unknown }>(
    "/api/auth/password-reset/recovery-code/verify",
    {
      ...(input.username ? { username: input.username } : {}),
      recoveryCode: input.recoveryCode
    },
        "Unable to verify the recovery code\nPlease try again"
  );

  if (typeof body.username !== "string") {
    throw new ApiRequestError("Unable to identify the account", 500);
  }

  return body.username;
}

export async function completePasswordReset(input: {
  newPassword: string;
  newPasswordConfirmation: string;
}) {
  const body = await postPasswordRecovery<{
    username?: unknown;
    recoveryCode?: unknown;
  }>(
    "/api/auth/password-reset/complete",
    input,
        "Unable to change the password\nPlease try again"
  );

  return {
    username: typeof body.username === "string" ? body.username : null,
    recoveryCode:
      typeof body.recoveryCode === "string" ? body.recoveryCode : null
  };
}

export async function cancelPasswordReset() {
  await postPasswordRecovery(
    "/api/auth/password-reset/cancel",
    undefined,
    "Unable to cancel account recovery"
  );
}
