import { ApiRequestError } from "./auth-api";
import type { RegistrationInput } from "./registration-validation";

export type UsernameRegistrationInput = {
  username: string;
  name: string;
  password: string;
  passwordConfirmation: string;
};

export type UsernameRegistrationResult = {
  username: string;
  recoveryCode: string;
};

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

async function createRegistrationError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    const issueMessage = body.issues?.find(
      (issue) => typeof issue.message === "string"
    )?.message;

    return new ApiRequestError(
      issueMessage ?? body.message ?? body.error ?? fallback,
      response.status,
      body.retryAfter ?? null
    );
  } catch {
    return new ApiRequestError(fallback, response.status);
  }
}

async function postRegistrationRequest(
  path: string,
  body: object,
  fallback: string
) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await createRegistrationError(response, fallback);
  }
}

export async function startRegistration(input: RegistrationInput) {
  await postRegistrationRequest(
    "/api/auth/register",
    input,
    "Unable to start registration. Please try again."
  );
}

export async function startUsernameRegistration(
  input: UsernameRegistrationInput,
): Promise<UsernameRegistrationResult> {
  const response = await fetch("/api/auth/register/username", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await createRegistrationError(
      response,
      "Unable to create your account. Please try again.",
    );
  }

  const body = (await response.json()) as {
    recoveryCode?: unknown;
    user?: { username?: unknown };
  };

  if (
    typeof body.recoveryCode !== "string" ||
    typeof body.user?.username !== "string"
  ) {
    throw new ApiRequestError("Unable to load your recovery code.", 500);
  }

  return {
    username: body.user.username,
    recoveryCode: body.recoveryCode,
  };
}

export async function checkUsernameAvailability(
  username: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `/api/auth/usernames/${encodeURIComponent(username)}/availability`,
    {
      method: "GET",
      credentials: "include",
      signal,
    },
  );

  if (!response.ok) {
    throw await createRegistrationError(
      response,
      "Unable to check username availability.",
    );
  }

  const body = (await response.json()) as { available?: unknown };

  if (typeof body.available !== "boolean") {
    throw new ApiRequestError("Unable to check username availability.", 500);
  }

  return body.available;
}

export async function resendRegistrationCode(email: string) {
  await postRegistrationRequest(
    "/api/auth/register/resend",
    { email },
    "Unable to resend the code. Please try again."
  );
}

export async function verifyRegistrationCode(email: string, code: string) {
  await postRegistrationRequest(
    "/api/auth/register/verify",
    { email, code },
    "Unable to verify the code. Please try again."
  );
}
