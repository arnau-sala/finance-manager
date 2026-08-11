import { useEffect, useRef } from "react";
import {
  BarChart3,
  DollarSign,
  ChevronLeft,
  CreditCard,
  FolderPlus,
  FolderKanban,
  Lightbulb,
  MessageSquare,
  StickyNotes,
  PieChart,
  Search,
  ShieldCheck,
  WalletCards
} from "lucide-react";

import { ActionButton } from "../../components/ui/ActionButton";

type AppVersionPageProps = {
  open: boolean;
  onSuggestFeature: () => void;
  onBack: () => void;
};

const currentFeatures = [
  {
    title: "Track transactions",
    description: "Add income and expenses with dates and categories",
    icon: WalletCards
  },
  {
    title: "Find movements",
    description: "Search, filter and open transaction details",
    icon: Search
  },
  {
    title: "Understand statistics",
    description: "Review money, categories, insights and expense habits",
    icon: BarChart3
  },
  {
    title: "Use charts",
    description: "Explore net worth, cash flow and category patterns",
    icon: PieChart
  },
  {
    title: "Manage access",
    description: "Use email, Google or username sign-in methods",
    icon: ShieldCheck
  }
] as const;

const futureFeatures = [
  {
    title: "Multiple money places",
    description: "Track cash, bank accounts, cards and investments",
    icon: FolderKanban
  },
  {
    title: "Custom categories",
    description: "Create categories that match your real habits",
    icon: FolderPlus
  },
  {
    title: "Expense bundles",
    description: "Group related income or expenses under one total",
    icon: StickyNotes
  },
  {
    title: "Multiple currencies",
    description: "Work with more than one currency when needed",
    icon: DollarSign
  },
  {
    title: "Faster card expenses",
    description: "Detect mobile card payments and add expenses with fewer taps",
    icon: CreditCard
  }
] as const;

export function AppVersionPage({
  open,
  onSuggestFeature,
  onBack
}: AppVersionPageProps) {
  const screenRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    screenRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open]);

  return (
    <div
      className={`account-flow-layer app-version-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <section
        ref={screenRef}
        className="auth-screen auth-screen--login auth-screen--register app-version-screen"
      >
        <ActionButton
          shape="icon"
          className="auth-back-button"
          type="button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.8} />
        </ActionButton>

          <section
            className="auth-panel app-version-panel"
            aria-labelledby="app-version-title"
          >
            <header className="auth-header auth-password-reset-header app-version-header">
              <span className="auth-recovery-code-icon" aria-hidden="true">
                <Lightbulb strokeWidth={1.7} />
              </span>
              <div className="auth-message">
                <h1 id="app-version-title">App version</h1>
                <p className="auth-subtitle">
                  Finance Manager 0.1.0
                </p>
              </div>
            </header>

            <div className="app-version-content">
              <section
                className="app-version-section"
                aria-labelledby="app-version-now-title"
              >
                <h2 id="app-version-now-title">What you can do now</h2>
                <div className="app-version-feature-list">
                  {currentFeatures.map(({ title, description, icon: Icon }) => (
                    <article className="app-version-feature" key={title}>
                      <span className="app-version-feature__icon" aria-hidden="true">
                        <Icon strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3>{title}</h3>
                        <p>{description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section
                className="app-version-section"
                aria-labelledby="app-version-next-title"
              >
                <h2 id="app-version-next-title">Coming next</h2>
                <div className="app-version-feature-list">
                  {futureFeatures.map(({ title, description, icon: Icon }) => (
                    <article className="app-version-feature" key={title}>
                      <span className="app-version-feature__icon" aria-hidden="true">
                        <Icon strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3>{title}</h3>
                        <p>{description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <ActionButton
                className="auth-primary-button app-version-suggestion-button"
                type="button"
                onClick={onSuggestFeature}
              >
                <MessageSquare aria-hidden="true" strokeWidth={1.8} />
                Suggest a feature
              </ActionButton>
            </div>
          </section>
      </section>
    </div>
  );
}
