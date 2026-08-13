import { useEffect, useRef, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { FatalErrorFallback } from "../src/observability/FatalErrorFallback";

const meta = {
  title: "App/Error states",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SomethingWentWrongWithSession: Story = {
  decorators: [
    (Story) => (
      <FeedbackFetchMock session="authenticated">
        <Story />
      </FeedbackFetchMock>
    ),
  ],
  render: () => (
    <div className="storybook-mobile-frame">
      <FatalErrorFallback />
    </div>
  ),
};

export const SomethingWentWrongWithoutSession: Story = {
  decorators: [
    (Story) => (
      <FeedbackFetchMock session="anonymous">
        <Story />
      </FeedbackFetchMock>
    ),
  ],
  render: () => (
    <div className="storybook-mobile-frame">
      <FatalErrorFallback />
    </div>
  ),
};

function FeedbackFetchMock({
  children,
  session,
}: {
  children: ReactNode;
  session: "authenticated" | "anonymous";
}) {
  const originalFetchRef = useRef(window.fetch);

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (url.endsWith("/api/auth/me")) {
      if (session === "authenticated") {
        return new Response(
          JSON.stringify({
            user: {
              id: "user_story_error",
              email: null,
              username: "arnau",
              name: "Arnau",
              authProvider: "PASSWORD",
              emailLoginEnabled: false,
              role: "USER",
              status: "APPROVED",
              startingNetWorth: "15000",
              createdAt: "2026-01-12T10:00:00.000Z",
              updatedAt: null,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (url.endsWith("/api/feedback")) {
      await new Promise((resolve) => window.setTimeout(resolve, 280));

      return new Response(JSON.stringify({ status: "created" }), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return originalFetchRef.current(input, init);
  };

  useEffect(() => {
    return () => {
      window.fetch = originalFetchRef.current;
    };
  }, []);

  return children;
}
