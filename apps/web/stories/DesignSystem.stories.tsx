import { useEffect, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Plus,
  Scale,
  Trash2
} from "lucide-react";

import { ActionButton } from "../src/components/ui/ActionButton";
import { ConfirmDialog } from "../src/components/ui/ConfirmDialog";
import {
  FeedbackConfirmationContent,
  SuccessCheckIcon
} from "../src/components/ui/FeedbackConfirmation";
import { SkeletonBlock } from "../src/components/ui/SkeletonBlock";
import {
  AndroidBrowserInstallScreen,
  AppleBrowserInstallScreen,
  DesktopBrowserLandingScreen
} from "../src/app/StandaloneGate";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../src/components/ui/SlidingSegmentedControl";
import { LegalAcceptanceCheckbox } from "../src/features/auth/LegalAcceptanceCheckbox";
import { LegalNoticeScreen } from "../src/features/auth/LegalNoticeScreen";

const meta = {
  title: "Design System/Overview",
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
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const periodOptions = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" }
] as const satisfies readonly SlidingSegmentOption<"month" | "year" | "all">[];

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

function SegmentedExamples() {
  const [period, setPeriod] = useState<"month" | "year" | "all">("month");
  const [view, setView] = useState<"list" | "charts">("list");

  return (
    <div className="storybook-section">
      <h2>Segmented controls</h2>
      <SlidingSegmentedControl
        value={period}
        options={periodOptions}
        onChange={setPeriod}
        label="Statistics period"
      />
      <SlidingSegmentedControl
        className="stats-view-toggle"
        value={view}
        options={[
          { value: "list", label: "List", icon: Check },
          { value: "charts", label: "Charts", icon: Scale }
        ]}
        onChange={setView}
        label="Statistics view"
        iconOnly
        allowDrag={false}
      />
    </div>
  );
}

function ConfirmDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="storybook-section">
      <h2>Dialog</h2>
      <ActionButton
        className="home-new-transaction"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span className="home-new-transaction__icon" aria-hidden="true">
          <Trash2 />
        </span>
        <span>Open confirm dialog</span>
        <ChevronRight aria-hidden="true" />
      </ActionButton>
      <ConfirmDialog
        open={open}
        title="Delete transaction?"
        description="This cannot be undone"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        icon={<AlertTriangle />}
        tone="danger"
        confirmTone="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

function LegalAcceptanceExample() {
  const [checked, setChecked] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalClosing, setLegalClosing] = useState(false);

  const closeLegal = () => {
    setLegalClosing(true);
  };

  return (
    <div className="storybook-section">
      <h2>Legal acceptance</h2>
      <LegalAcceptanceCheckbox
        id="storybook-legal-acceptance"
        checked={checked}
        onChange={setChecked}
        onOpenLegal={() => {
          setLegalClosing(false);
          setLegalOpen(true);
        }}
      />
      {legalOpen ? (
        <LegalNoticeScreen
          closing={legalClosing}
          onClose={closeLegal}
          onClosed={() => {
            setLegalOpen(false);
            setLegalClosing(false);
          }}
        />
      ) : null}
    </div>
  );
}

export const Components: Story = {
  render: () => (
    <main className="storybook-mobile-frame">
      <div className="storybook-stack">
        <section className="storybook-section">
          <h2>Buttons</h2>
          <ActionButton
            className="home-new-transaction"
            type="button"
          >
            <span className="home-new-transaction__icon" aria-hidden="true">
              <Plus />
            </span>
            <span>New transaction</span>
            <ChevronRight aria-hidden="true" />
          </ActionButton>
          <ActionButton className="auth-primary-button" type="button">
            Continue
          </ActionButton>
          <div className="storybook-row">
            <ActionButton shape="icon" className="auth-back-button" type="button">
              <ArrowRight aria-hidden="true" />
            </ActionButton>
            <ActionButton shape="card" className="profile-action" type="button">
              <span className="profile-action__icon" aria-hidden="true">
                <Scale />
              </span>
              <span className="profile-action__label">Edit profile</span>
              <ChevronRight className="profile-action__chevron" aria-hidden="true" />
            </ActionButton>
          </div>
        </section>

        <section className="storybook-section">
          <h2>Text fields</h2>
          <label className="auth-form-field">
            <span className="text-field-label">Email address</span>
            <input className="text-field" type="email" defaultValue="arnau@example.com" />
          </label>
          <label className="auth-form-field">
            <span className="text-field-label">Amount</span>
            <input className="text-field" inputMode="decimal" defaultValue="1250,50" />
          </label>
        </section>

        <SegmentedExamples />

        <section className="storybook-section">
          <h2>Skeletons</h2>
          <SkeletonBlock width="100%" height={46} radius={16} />
          <div className="transaction-row__content">
            <SkeletonBlock width={36} height={36} radius="50%" />
            <span className="home-overview-skeleton__move-details">
              <SkeletonBlock width="72%" height={14} />
              <SkeletonBlock width="52%" height={11} />
            </span>
            <SkeletonBlock width={58} height={14} />
          </div>
        </section>

        <ConfirmDialogExample />

        <section className="storybook-section">
          <h2>Feedback confirmation</h2>
          <div className="auth-recovery-code-header">
            <SuccessCheckIcon />
          </div>
          <FeedbackConfirmationContent
            anonymousLabel="Anonymous feedback"
            email="arnau@example.com"
            message="The desktop landing feels clear and the mobile guide is easy to follow"
            review="I will review it and use it to improve the app"
            sentLabel="Feedback sent"
            sender="Arnau"
            summaryLabel="Sent feedback summary"
            thanks="Thank you for the feedback"
          />
        </section>

        <LegalAcceptanceExample />
      </div>
    </main>
  )
};

export const AppleNavigatorPage: Story = {
  name: "Apple navigator page",
  render: () => <AppleBrowserInstallScreen />
};

export const AndroidNavigatorPage: Story = {
  name: "Android navigator page",
  render: () => <AndroidBrowserInstallScreen />
};

export const DesktopLandingPage: Story = {
  name: "Desktop landing page",
  render: () => <DesktopBrowserLandingScreen />
};
