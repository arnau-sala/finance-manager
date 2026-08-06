const BREVO_TRANSACTIONAL_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_REQUEST_TIMEOUT_MS = 8_000;

type BrevoConfig = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
};

type TransactionalEmail = {
  to: {
    email: string;
    name?: string;
  };
  subject: string;
  htmlContent: string;
  textContent?: string;
  tag: string;
};

export class EmailConfigurationError extends Error {
  constructor(message = "Email delivery is not configured.") {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getBrevoConfig(): BrevoConfig {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase();
  const senderName =
    process.env.BREVO_SENDER_NAME?.trim() || "Finance Manager";

  if (!apiKey || !senderEmail) {
    throw new EmailConfigurationError();
  }

  return { apiKey, senderEmail, senderName };
}

export function assertTransactionalEmailConfigured() {
  getBrevoConfig();
}

export async function sendTransactionalEmail(email: TransactionalEmail) {
  const config = getBrevoConfig();

  let response: Response;

  try {
    response = await fetch(BREVO_TRANSACTIONAL_EMAIL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: config.senderEmail,
          name: config.senderName,
        },
        to: [email.to],
        subject: email.subject,
        htmlContent: email.htmlContent,
        ...(email.textContent ? { textContent: email.textContent } : {}),
        tags: [email.tag],
      }),
      signal: AbortSignal.timeout(BREVO_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new EmailDeliveryError(
      error instanceof Error
        ? `Brevo request failed: ${error.message}`
        : "Brevo request failed.",
    );
  }

  if (response.status !== 201) {
    throw new EmailDeliveryError(
      "Brevo rejected the email request.",
      response.status,
    );
  }
}
