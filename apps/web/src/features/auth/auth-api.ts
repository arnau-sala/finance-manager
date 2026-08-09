type LoginInput = {
  identifier: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
};

export type RecoveryCodeResetResult = {
  username: string;
  recoveryCode: string;
  rotationToken: string;
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
  username?: string;
  name?: string;
  startingNetWorth?: string;
};

export type BeginEmailLinkInput = {
  email?: string;
  password?: string;
  passwordConfirmation?: string;
};

export type LinkUsernameInput = {
  username: string;
  password?: string;
  passwordConfirmation?: string;
};

export type UsernameLinkResult = {
  user: SessionUser;
  recoveryCode: string;
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
  emailLoginEnabled: boolean;
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

export async function linkUsername(
  input: LinkUsernameInput,
): Promise<UsernameLinkResult> {
  const response = await fetch("/api/account/username/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to link username");
  }

  const body = (await response.json()) as Partial<UsernameLinkResult>;

  if (
    typeof body.recoveryCode !== "string" ||
    !body.user ||
    typeof body.user.username !== "string"
  ) {
    throw new ApiRequestError("Invalid username linking response", 500);
  }

  return body as UsernameLinkResult;
}

export async function unlinkUsername(password: string) {
  const response = await fetch("/api/account/username/unlink", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to unlink username");
  }

  const body = (await response.json()) as { user?: SessionUser };

  if (!body.user) {
    throw new ApiRequestError("Invalid username unlink response", 500);
  }

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

export async function resetRecoveryCode(signOutOtherDevices: boolean) {
  const response = await fetch("/api/account/recovery-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ signOutOtherDevices })
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to reset the recovery code"
    );
  }

  const body = (await response.json()) as Partial<RecoveryCodeResetResult>;

  if (
    typeof body.username !== "string" ||
    typeof body.recoveryCode !== "string" ||
    typeof body.rotationToken !== "string"
  ) {
    throw new ApiRequestError("Invalid recovery code response", 500);
  }

  return body as RecoveryCodeResetResult;
}

export async function activateRecoveryCodeReset(rotationToken: string) {
  const response = await fetch("/api/account/recovery-code/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ rotationToken })
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to activate the recovery code"
    );
  }
}

export async function beginEmailLink(input: BeginEmailLinkInput) {
  const response = await fetch("/api/account/email/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to link this email");
  }
}

export async function resendEmailLinkCode() {
  const response = await fetch("/api/account/email/link/resend", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to resend the verification code"
    );
  }
}

export async function verifyEmailLinkCode(code: string) {
  const response = await fetch("/api/account/email/link/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to verify the email"
    );
  }

  const body = (await response.json()) as Partial<UpdateProfileResponse>;

  if (!body.user) {
    throw new ApiRequestError("Invalid email link response", 500);
  }

  return body.user;
}

export async function cancelEmailLink() {
  const response = await fetch("/api/account/email/link", {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok && response.status !== 401) {
    throw await createApiRequestError(response, "Unable to cancel email linking");
  }
}

export async function beginEmailUnlink() {
  const response = await fetch("/api/account/email/unlink", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to send the verification code"
    );
  }
}

export async function resendEmailUnlinkCode() {
  const response = await fetch("/api/account/email/unlink/resend", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to resend the verification code"
    );
  }
}

export async function verifyEmailUnlinkCode(code: string) {
  const response = await fetch("/api/account/email/unlink/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to unlink email");
  }

  const body = (await response.json()) as Partial<UpdateProfileResponse>;

  if (!body.user) {
    throw new ApiRequestError("Invalid email unlink response", 500);
  }

  return body.user;
}

export async function cancelEmailUnlink() {
  const response = await fetch("/api/account/email/unlink", {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok && response.status !== 401) {
    throw await createApiRequestError(
      response,
      "Unable to cancel email unlinking"
    );
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

export async function startGoogleAccountUnlink() {
  const response = await fetch("/api/account/google/unlink/start", {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw await createApiRequestError(
      response,
      "Unable to unlink your Google account."
    );
  }

  const body = (await response.json()) as GoogleAuthorizationStartResponse;

  if (!body.authorizationUrl) {
    throw new ApiRequestError("Unable to verify your Google account.", 500);
  }

  return body.authorizationUrl;
}
