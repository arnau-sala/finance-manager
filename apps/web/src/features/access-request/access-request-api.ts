import type { AccessRequestInput } from "./access-request-validation";

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
