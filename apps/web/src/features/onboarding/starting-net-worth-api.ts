import {
  ApiRequestError,
  type SessionUser
} from "../auth/auth-api";

type StartingNetWorthAction =
  | {
      action: "SET";
      amount: string;
    }
  | {
      action: "SKIP";
    };

type StartingNetWorthResponse = {
  user: SessionUser;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Unable to finish account setup.";
  } catch {
    return "Unable to finish account setup.";
  }
}

async function completeStartingNetWorthSetup(
  input: StartingNetWorthAction
) {
  const response = await fetch("/api/account/onboarding/starting-net-worth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new ApiRequestError(await readError(response), response.status);
  }

  const body = (await response.json()) as StartingNetWorthResponse;
  return body.user;
}

export function saveStartingNetWorth(amount: string) {
  return completeStartingNetWorthSetup({
    action: "SET",
    amount
  });
}

export function skipStartingNetWorth() {
  return completeStartingNetWorthSetup({ action: "SKIP" });
}
