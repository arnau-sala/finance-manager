type LoginInput = {
  email: string;
  password: string;
};

type ApiErrorResponse = {
  error?: string;
  retryAfter?: string;
};

type GoogleAccountDeletionStartResponse = {
  authorizationUrl: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(message: string, status: number, retryAfter: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type GoogleAccessRequestContext = {
  request: {
    email: string;
    name: string;
    message: string;
  };
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  authProvider: "PASSWORD" | "GOOGLE";
  role: "USER" | "ADMIN";
  status: "APPROVED" | "SUSPENDED";
  createdAt: string;
  updatedAt: string | null;
};

type CurrentSessionResponse = {
  user: SessionUser;
};

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function createApiRequestError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return new ApiRequestError(
      body.error ?? fallback,
      response.status,
      body.retryAfter ?? null
    );
  } catch {
    return new ApiRequestError(fallback, response.status);
  }
}

export async function login(input: LoginInput) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Login failed."));
  }
}

export async function getCurrentSession() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include"
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load the current session.");
  }

  const body = (await response.json()) as CurrentSessionResponse;
  return body.user;
}

export async function getGoogleAccessRequestContext() {
  const response = await fetch("/api/auth/google/request-context", {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Google request context not found.");
  }

  const body = (await response.json()) as GoogleAccessRequestContext;
  return body.request;
}

export async function logout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(await readErrorMessage(response, "Unable to log out."));
  }
}

export async function deleteAccount(password: string) {
  const response = await fetch("/api/account", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to delete account.");
  }
}

export async function startGoogleAccountDeletion() {
  const response = await fetch("/api/account/google/delete/start", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to verify your Google account."
    );
  }

  const body = (await response.json()) as GoogleAccountDeletionStartResponse;

  if (!body.authorizationUrl) {
    throw new ApiRequestError("Unable to verify your Google account.", 500);
  }

  return body.authorizationUrl;
}
