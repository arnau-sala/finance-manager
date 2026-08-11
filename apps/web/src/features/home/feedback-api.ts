import { ApiRequestError } from "../auth/auth-api";

type SubmitFeedbackInput = {
  anonymous: boolean;
  email?: string;
  message: string;
  type: "general" | "suggestion";
};

type ApiErrorResponse = {
  error?: string;
  retryAfter?: string;
};

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

export async function submitFeedback(input: SubmitFeedbackInput) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to send feedback");
  }
}
