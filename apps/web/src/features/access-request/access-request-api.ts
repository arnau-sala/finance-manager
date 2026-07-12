import type { AccessRequestInput } from "./access-request-validation";

export const GOOGLE_ACCESS_REQUEST_MESSAGE = "Requested access using Google sign-in.";
const GOOGLE_MESSAGE_SEPARATOR = "\n\n";

type ApiErrorResponse = {
  error?: string;
  message?: string;
  issues?: Array<{
    message?: string;
  }>;
};

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorResponse;

    return (
      body.issues?.[0]?.message ??
      body.message ??
      body.error ??
      "Unable to submit your request. Please try again."
    );
  } catch {
    return "Unable to submit your request. Please try again.";
  }
}

export function getGoogleAccessRequestMessage(message: string) {
  const trimmedMessage = message.trim();

  return trimmedMessage
    ? `${trimmedMessage}${GOOGLE_MESSAGE_SEPARATOR}${GOOGLE_ACCESS_REQUEST_MESSAGE}`
    : GOOGLE_ACCESS_REQUEST_MESSAGE;
}

export async function submitAccessRequest(input: AccessRequestInput) {
  let response: Response;

  try {
    response = await fetch("/api/access-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(input)
    });
  } catch {
    throw new Error("Unable to connect. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function submitGoogleAccessRequest(input: {
  name: string;
  message: string;
}) {
  let response: Response;

  try {
    response = await fetch("/api/access-requests/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(input)
    });
  } catch {
    throw new Error("Unable to connect. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
