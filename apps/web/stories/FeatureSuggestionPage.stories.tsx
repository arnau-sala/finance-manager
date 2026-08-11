import { useEffect, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { FeatureSuggestionPage } from "../src/features/home/FeatureSuggestionPage";
import type { SessionUser } from "../src/features/auth/auth-api";

const meta = {
  title: "Pages/Feature suggestion",
  component: FeatureSuggestionPage,
  parameters: {
    layout: "fullscreen"
  },
  decorators: [
    (Story) => (
      <FeedbackFetchMock>
        <Story />
      </FeedbackFetchMock>
    )
  ]
} satisfies Meta<typeof FeatureSuggestionPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseUser = {
  id: "user_story",
  name: "Arnau",
  role: "USER",
  status: "APPROVED",
  startingNetWorth: "15000",
  createdAt: "2026-01-12T10:00:00.000Z",
  updatedAt: null
} satisfies Pick<
  SessionUser,
  | "id"
  | "name"
  | "role"
  | "status"
  | "startingNetWorth"
  | "createdAt"
  | "updatedAt"
>;

const emailUser = {
  ...baseUser,
  email: "arnau@example.com",
  username: "arnau",
  authProvider: "PASSWORD_AND_GOOGLE",
  emailLoginEnabled: true
} satisfies SessionUser;

const usernameOnlyUser = {
  ...baseUser,
  email: null,
  username: "arnau",
  authProvider: "PASSWORD",
  emailLoginEnabled: false
} satisfies SessionUser;

function FeedbackFetchMock({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url.endsWith("/api/feedback")) {
        await new Promise((resolve) => window.setTimeout(resolve, 280));

        return new Response(JSON.stringify({ status: "created" }), {
          status: 201,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return children;
}

export const WithLinkedEmail: Story = {
  args: {
    open: true,
    user: emailUser,
    onBack: () => undefined,
    onSessionExpired: () => undefined
  }
};

export const UsernameOnly: Story = {
  args: {
    open: true,
    user: usernameOnlyUser,
    onBack: () => undefined,
    onSessionExpired: () => undefined
  }
};
