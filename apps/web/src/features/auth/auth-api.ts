type LoginInput = {
  identifier: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
};

type ApiErrorResponse = {
  error?: string;
  retryAfter?: string;
};

type GoogleAuthorizationStartResponse = {
  authorizationUrl: string;
};

type UpdateProfileResponse = {
  user: SessionUser;
};

export type UpdateProfileInput = {
  name?: string;
  startingNetWorth?: string;
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

export type SessionUser = {
  id: string;
  email: string | null;
  username: string | null;
  name: string;
  authProvider: "PASSWORD" | "GOOGLE" | "PASSWORD_AND_GOOGLE";
  role: "USER" | "ADMIN";
  status: "APPROVED" | "SUSPENDED";
  startingNetWorth: string | null;
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

export async function updateProfile(input: UpdateProfileInput) {
  const response = await fetch("/api/account", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to update profile.");
  }

  const body = (await response.json()) as UpdateProfileResponse;
  return body.user;
}

export async function changePassword(input: ChangePasswordInput) {
  const response = await fetch("/api/account/password", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to change password.");
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

  const body = (await response.json()) as GoogleAuthorizationStartResponse;

  if (!body.authorizationUrl) {
    throw new ApiRequestError("Unable to verify your Google account.", 500);
  }

  return body.authorizationUrl;
}

export async function startGoogleAccountLink() {
  const response = await fetch("/api/account/google/link/start", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to link your Google account."
    );
  }

  const body = (await response.json()) as GoogleAuthorizationStartResponse;

  if (!body.authorizationUrl) {
    throw new ApiRequestError("Unable to link your Google account.", 500);
  }

  return body.authorizationUrl;
}
