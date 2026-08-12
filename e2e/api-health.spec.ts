import { expect, test } from "@playwright/test";

test("API health endpoint is available", async ({ request, baseURL }) => {
  const apiUrl = (
    process.env.E2E_API_URL ??
    (baseURL?.includes("127.0.0.1")
      ? "http://127.0.0.1:3001"
      : new URL("/api", baseURL).toString())
  ).replace(/\/$/, "");
  const response = await request.get(`${apiUrl}/health`);

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
