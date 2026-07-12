type LoginInput = {
  email: string;
  password: string;
};

type ApiErrorResponse = {
  error?: string;
};

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
