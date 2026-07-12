type LoginInput = {
  email: string;
  password: string;
};

type ApiErrorResponse = {
  error?: string;
};

type GoogleAccessRequestResult = {
  request: {
    email: string;
    name: string;
    message: string;
  };
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

  return response.ok;
}

export async function getGoogleAccessRequestResult() {
  const response = await fetch("/api/auth/google/request-result", {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Google request result not found.");
  }

  const body = (await response.json()) as GoogleAccessRequestResult;
  return body.request;
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });
}
