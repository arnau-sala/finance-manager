import { ApiRequestError } from "./auth-api";
import type { RegistrationInput } from "./registration-validation";

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
