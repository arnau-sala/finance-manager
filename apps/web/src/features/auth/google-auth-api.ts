import { ApiRequestError } from "./auth-api";

export type GoogleAuthIntent = "login" | "register";

export type GoogleAuthAction = {
  intent: GoogleAuthIntent;
  action:
    | "create-account"
    | "sign-in-with-google"
    | "sign-in-with-password";
  email: string;
};

type GoogleAuthActionResponse = {
  action?: GoogleAuthAction;
};

export type GoogleAuthConfirmation =
  | { status: "authenticated" }
  | { status: "password-required"; email: string };

async function createGoogleAuthError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return new ApiRequestError(body.error ?? fallback, response.status);
  } catch {
    return new ApiRequestError(fallback, response.status);
  }
}

export function getGoogleAuthStartUrl(intent: GoogleAuthIntent) {
  return `/api/auth/google/start?intent=${intent}`;
}

export async function acceptGoogleRegistrationLegalTerms() {
  const response = await fetch("/api/auth/google/register/legal-acceptance", {
    method: "POST",
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createGoogleAuthError(
      response,
      "Unable to prepare Google registration"
    );
  }
}

export async function getGoogleAuthAction() {
  const response = await fetch("/api/auth/google/action", {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createGoogleAuthError(
      response,
      "Unable to continue with Google"
    );
  }

  const body = (await response.json()) as GoogleAuthActionResponse;

  if (
    !body.action ||
    (body.action.intent !== "login" && body.action.intent !== "register") ||
    ![
      "create-account",
      "sign-in-with-google",
      "sign-in-with-password"
    ].includes(body.action.action) ||
    typeof body.action.email !== "string"
  ) {
    throw new ApiRequestError("Unable to continue with Google", 500);
  }

  return body.action;
}

export async function confirmGoogleAuthAction(input?: {
  legalAccepted?: boolean;
}) {
  const response = await fetch("/api/auth/google/action/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input ?? {})
  });

  if (!response.ok) {
    throw await createGoogleAuthError(
      response,
      "Unable to continue with Google"
    );
  }

  const body = (await response.json()) as Partial<GoogleAuthConfirmation>;

  if (body.status === "authenticated") {
    return { status: "authenticated" } as const;
  }

  if (body.status === "password-required" && typeof body.email === "string") {
    return { status: "password-required", email: body.email } as const;
  }

  throw new ApiRequestError("Unable to continue with Google", 500);
}

export async function cancelGoogleAuthAction() {
  const response = await fetch("/api/auth/google/action/cancel", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createGoogleAuthError(response, "Unable to cancel Google flow");
  }
}
