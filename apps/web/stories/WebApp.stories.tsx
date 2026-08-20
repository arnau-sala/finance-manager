import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AuthLandingPage } from "../src/features/auth/AuthLandingPage";
import { CreateAccountPage } from "../src/features/auth/CreateAccountPage";
import { PasswordLoginPage } from "../src/features/auth/PasswordLoginPage";
import {
  PasswordRecoveryFlow,
  type PasswordRecoveryStart
} from "../src/features/auth/PasswordRecoveryFlow";
import { RegistrationMethodPage } from "../src/features/auth/RegistrationMethodPage";
import { StartingNetWorthPage } from "../src/features/onboarding/StartingNetWorthPage";
import { HomePage } from "../src/features/home/HomePage";
import type { HomeSectionId } from "../src/features/home/home-sections";
import {
  installFullAppMockFetch,
  johnSmithUser
} from "./full-app-mocks";

type AppStoryProps = {
  initialSection?: HomeSectionId;
  allowNewTransaction?: boolean;
};

type AuthFlowScreen =
  | "landing"
  | "login"
  | "register-method"
  | "register-form"
  | "password-recovery";

const meta = {
  title: "Pages/Web app",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function StorybookQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function FullAppFetchMock({
  mode,
  children
}: {
  mode: "anonymous" | "authenticated";
  children: ReactNode;
}) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<typeof mode | null>(null);

  if (modeRef.current !== mode) {
    cleanupRef.current?.();
    cleanupRef.current = installFullAppMockFetch(mode);
    modeRef.current = mode;
  }

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      modeRef.current = null;
    },
    []
  );

  return children;
}

function FullAppStoryProvider({
  mode,
  children
}: {
  mode: "anonymous" | "authenticated";
  children: ReactNode;
}) {
  return (
    <StorybookQueryProvider>
      <FullAppFetchMock mode={mode}>{children}</FullAppFetchMock>
    </StorybookQueryProvider>
  );
}

function AuthScreenFrame({
  screen,
  children
}: {
  screen: AuthFlowScreen;
  children: ReactNode;
}) {
  return (
    <div className={`auth-flow auth-flow--${screen}`}>
      <div
        className={`auth-flow-page auth-flow-page--${screen}`}
        aria-hidden={false}
      >
        {children}
      </div>
    </div>
  );
}

function AuthenticatedAppStory({
  initialSection = "home",
  allowNewTransaction = false
}: AppStoryProps) {
  const [user, setUser] = useState(johnSmithUser);

  return (
    <HomePage
      user={user}
      initialSection={initialSection}
      lockSectionNavigation
      allowLockedNewTransaction={allowNewTransaction}
      onProfileUpdated={setUser}
      onLogout={async () => undefined}
      onAccountDeleted={() => undefined}
      onSessionExpired={() => undefined}
      onInitialContentReady={() => undefined}
      googleAccountDeletionFeedback={null}
      onGoogleAccountDeletionFeedbackHandled={() => undefined}
      googleAccountLinkFeedback={null}
      onGoogleAccountLinkFeedbackHandled={() => undefined}
      googleAccountUnlinkFeedback={null}
      onGoogleAccountUnlinkFeedbackHandled={() => undefined}
    />
  );
}

export const Landing: Story = {
  render: () => (
    <FullAppStoryProvider mode="anonymous">
      <AuthScreenFrame screen="landing">
        <AuthLandingPage
          onIdentifierContinue={() => undefined}
          onCreateAccount={() => undefined}
          onGoogleContinue={() => undefined}
          onPasswordRecoveryStart={() => undefined}
        />
      </AuthScreenFrame>
    </FullAppStoryProvider>
  )
};

export const Login: Story = {
  render: () => (
    <FullAppStoryProvider mode="anonymous">
      <AuthScreenFrame screen="login">
        <PasswordLoginPage
          identifier="johnsmith"
          onBack={() => undefined}
          onLoginSuccess={() => undefined}
          onPasswordRecoveryStart={() => undefined}
        />
      </AuthScreenFrame>
    </FullAppStoryProvider>
  )
};

export const CreateAccountMethods: Story = {
  render: () => (
    <FullAppStoryProvider mode="anonymous">
      <AuthScreenFrame screen="register-method">
        <RegistrationMethodPage
          onBack={() => undefined}
          onSelect={() => undefined}
        />
      </AuthScreenFrame>
    </FullAppStoryProvider>
  )
};

export const CreateEmailAccount: Story = {
  render: () => (
    <FullAppStoryProvider mode="anonymous">
      <AuthScreenFrame screen="register-form">
        <CreateAccountPage
          method="email"
          onBack={() => undefined}
          onRegistrationStarted={() => undefined}
          onUsernameRegistrationCreated={() => undefined}
        />
      </AuthScreenFrame>
    </FullAppStoryProvider>
  )
};

export const CreateUsernameAccount: Story = {
  render: () => (
    <FullAppStoryProvider mode="anonymous">
      <AuthScreenFrame screen="register-form">
        <CreateAccountPage
          method="username"
          onBack={() => undefined}
          onRegistrationStarted={() => undefined}
          onUsernameRegistrationCreated={() => undefined}
        />
      </AuthScreenFrame>
    </FullAppStoryProvider>
  )
};

export const PasswordRecovery: Story = {
  render: () => {
    const start: PasswordRecoveryStart = {
      method: "email",
      identifier: "john.smith@example.com"
    };

    return (
      <FullAppStoryProvider mode="anonymous">
        <AuthScreenFrame screen="password-recovery">
          <PasswordRecoveryFlow
            start={start}
            returnTarget="landing"
            onReturnToLanding={() => undefined}
            onReturnToLogin={() => undefined}
          />
        </AuthScreenFrame>
      </FullAppStoryProvider>
    );
  }
};

export const StartingNetWorth: Story = {
  render: () => (
    <FullAppStoryProvider mode="authenticated">
      <StartingNetWorthPage
        onComplete={() => undefined}
        onSessionExpired={() => undefined}
      />
    </FullAppStoryProvider>
  )
};

export const AppHome: Story = {
  render: () => (
    <FullAppStoryProvider mode="authenticated">
      <AuthenticatedAppStory
        initialSection="home"
        allowNewTransaction
      />
    </FullAppStoryProvider>
  )
};

export const AppTransactions: Story = {
  render: () => (
    <FullAppStoryProvider mode="authenticated">
      <AuthenticatedAppStory
        initialSection="moves"
        allowNewTransaction
      />
    </FullAppStoryProvider>
  )
};

export const AppStatistics: Story = {
  render: () => (
    <FullAppStoryProvider mode="authenticated">
      <AuthenticatedAppStory initialSection="stats" />
    </FullAppStoryProvider>
  )
};

export const AppProfile: Story = {
  render: () => (
    <FullAppStoryProvider mode="authenticated">
      <AuthenticatedAppStory initialSection="profile" />
    </FullAppStoryProvider>
  )
};
