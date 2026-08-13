import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";

import {
  renderAccountEmailUnlinkVerificationEmail,
  renderAccountEmailVerificationEmail,
  renderEmailLinkConflictNoticeEmail,
  renderGooglePasswordGuidanceEmail,
  renderPasswordChangedEmail,
  renderPasswordResetCodeEmail,
  renderRegistrationVerificationEmail,
} from "../../api/src/email/templates";

const meta = {
  title: "Emails/Brevo templates",
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "Muted surface",
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type EmailPreview = {
  title: string;
  subject: string;
  tag: string;
  html: string;
};

const sampleEmail = "arnau@example.com";
const sampleName = "Arnau";
const sampleCode = "482913";

const emailPreviews: EmailPreview[] = [
  {
    title: "Registration verification",
    subject: "Verify your Finance Manager account",
    tag: "registration-verification",
    html: renderRegistrationVerificationEmail({
      code: sampleCode,
      expiresInMinutes: 10,
    }),
  },
  {
    title: "Password reset code",
    subject: "Reset your Finance Manager password",
    tag: "password-reset-code",
    html: renderPasswordResetCodeEmail({
      name: sampleName,
      code: sampleCode,
      expiresInMinutes: 10,
    }),
  },
  {
    title: "Google password guidance",
    subject: "Use Google to access Finance Manager",
    tag: "password-reset-google-guidance",
    html: renderGooglePasswordGuidanceEmail({
      email: sampleEmail,
      name: sampleName,
    }),
  },
  {
    title: "Password changed",
    subject: "Your Finance Manager password was changed",
    tag: "password-reset-complete",
    html: renderPasswordChangedEmail({ name: sampleName }),
  },
  {
    title: "Link email verification, username account",
    subject: "Link your email to Finance Manager",
    tag: "account-email-verification",
    html: renderAccountEmailVerificationEmail({
      username: "arnausaala",
      code: sampleCode,
      expiresInMinutes: 10,
    }),
  },
  {
    title: "Link email verification, Google account",
    subject: "Link your email to Finance Manager",
    tag: "account-email-verification",
    html: renderAccountEmailVerificationEmail({
      username: null,
      code: sampleCode,
      expiresInMinutes: 10,
    }),
  },
  {
    title: "Unlink email verification",
    subject: "Confirm email removal from Finance Manager",
    tag: "account-email-unlink-verification",
    html: renderAccountEmailUnlinkVerificationEmail({
      code: sampleCode,
      expiresInMinutes: 10,
    }),
  },
  {
    title: "Email link conflict notice",
    subject: "Email linking attempt on Finance Manager",
    tag: "account-email-link-conflict",
    html: renderEmailLinkConflictNoticeEmail(),
  },
];

function EmailTemplateCard({ preview }: { preview: EmailPreview }) {
  return (
    <section style={styles.card}>
      <header style={styles.header}>
        <div style={styles.headerText}>
          <h2 style={styles.title}>{preview.title}</h2>
          <p style={styles.subject}>{preview.subject}</p>
        </div>
        <span style={styles.tag}>{preview.tag}</span>
      </header>
      <div style={styles.previewShell}>
        <iframe
          title={preview.title}
          srcDoc={preview.html}
          style={styles.iframe}
        />
      </div>
    </section>
  );
}

export const All: Story = {
  render: () => (
    <main style={styles.page}>
      <header style={styles.pageHeader}>
        <p style={styles.eyebrow}>Brevo</p>
        <h1 style={styles.pageTitle}>Transactional emails</h1>
        <p style={styles.description}>
          Real HTML templates used by Finance Manager when sending email
        </p>
      </header>

      <div style={styles.stack}>
        {emailPreviews.map((preview) => (
          <EmailTemplateCard
            key={`${preview.tag}-${preview.title}`}
            preview={preview}
          />
        ))}
      </div>
    </main>
  ),
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gap: 24,
    padding: "34px min(5vw, 46px) 46px",
    background: "var(--color-surface-muted)",
    color: "var(--color-text)",
  },
  pageHeader: {
    display: "grid",
    gap: 7,
    maxWidth: 760,
  },
  eyebrow: {
    margin: 0,
    color: "var(--color-primary)",
    fontSize: 13,
    lineHeight: 1.3,
    fontWeight: 500,
  },
  pageTitle: {
    margin: 0,
    color: "var(--color-text)",
    fontSize: 34,
    lineHeight: 1.15,
    fontWeight: 400,
    letterSpacing: 0,
  },
  description: {
    margin: 0,
    color: "var(--color-text-muted)",
    fontSize: 15,
    lineHeight: 1.5,
  },
  stack: {
    display: "grid",
    gap: 22,
  },
  card: {
    display: "grid",
    gap: 14,
    padding: 18,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--modal-radius)",
    boxShadow: "var(--shadow-soft)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerText: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  title: {
    margin: 0,
    color: "var(--color-text)",
    fontSize: 18,
    lineHeight: 1.3,
    fontWeight: 500,
  },
  subject: {
    margin: 0,
    color: "var(--color-text-muted)",
    fontSize: 13,
    lineHeight: 1.4,
  },
  tag: {
    flex: "0 0 auto",
    maxWidth: "48%",
    padding: "7px 10px",
    overflow: "hidden",
    color: "var(--color-primary)",
    background: "var(--color-primary-soft)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  previewShell: {
    overflow: "hidden",
    background: "#f7f8fa",
    border: "1px solid var(--color-border)",
    borderRadius: 18,
  },
  iframe: {
    width: "100%",
    height: 430,
    display: "block",
    border: 0,
    background: "#f7f8fa",
  },
} satisfies Record<string, CSSProperties>;
