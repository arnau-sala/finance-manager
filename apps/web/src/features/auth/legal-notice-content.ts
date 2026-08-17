import { authContactEmail } from "../../config/brand";

export type LegalNoticeSection = {
  title: string;
  items: string[];
};

export const legalNoticeUpdatedOn = "Last updated 14 August 2026";

export const legalNoticeSummaryItems = [
  "You enter your finances manually",
  "The app does not connect to banks",
  "No ads or tracking cookies are used",
  "Your data is not sold",
  "You can delete your account from the app",
  "The project is visible code, but all rights are reserved unless a license says otherwise"
];

export const privacySections: LegalNoticeSection[] = [
  {
    title: "Who controls your data",
    items: [
      "Finance Manager is controlled by Arnau Sala Araujo, Barcelona, Spain",
      `Contact email: ${authContactEmail}`,
      "This notice is written for users in the European Economic Area and follows the GDPR transparency principles"
    ]
  },
  {
    title: "What this app does",
    items: [
      "Finance Manager helps you manually track personal income, expenses, categories, dates, net worth and statistics",
      "The app does not connect to banks, does not import bank statements and does not ask for bank credentials",
      "All financial records are entered, edited or deleted manually by the user"
    ]
  },
  {
    title: "Data we process",
    items: [
      "Account data such as name, email, username, Google account identifier, password login status and account creation date",
      "Security data such as hashed passwords, hashed recovery codes, session data, verification codes and sign-in activity needed to protect the account",
      "Financial data entered by the user, including transaction name, amount, category, type, date and starting net worth",
      "Technical data needed to run the service, such as server logs, request metadata, device and browser information, error data and security events",
      "Anonymous page-view and performance data, such as visited paths, approximate country, browser, device type and Core Web Vitals",
      "Interface preferences such as whether net worth is hidden"
    ]
  },
  {
    title: "Operator access",
    items: [
      "Financial data is stored in the production database so the app can show transactions, summaries, statistics and charts",
      "The service operator may technically access this data when necessary to operate, debug, secure or support the service",
      "The service operator does not access transaction data out of curiosity, for advertising, for profiling or for any purpose unrelated to running or protecting the app",
      "Direct production database access should be kept limited and used only when there is a real operational, support, security or legal reason"
    ]
  },
  {
    title: "Why we process data",
    items: [
      "To create and manage user accounts",
      "To provide transaction tracking, home summaries, statistics and charts",
      "To authenticate users with email, username, password, Google sign-in or recovery code",
      "To send verification, recovery and account security emails",
      "To understand aggregate usage, diagnose errors and improve app performance",
      "To prevent abuse, protect accounts and maintain the reliability of the service",
      "To comply with legal obligations when they apply"
    ]
  },
  {
    title: "Legal bases",
    items: [
      "Contract necessity for creating the account and providing the app features requested by the user",
      "Legitimate interest for security, fraud prevention, aggregate usage measurement, performance monitoring, debugging, service integrity and abuse prevention",
      "Legal obligation where records must be kept or disclosed under applicable law",
      "Consent or user choice where optional account methods such as Google sign-in are selected by the user"
    ]
  },
  {
    title: "Service providers",
    items: [
      "Vercel hosts and delivers the web app and provides anonymous Web Analytics and performance measurement through Speed Insights",
      "Neon provides the PostgreSQL database that stores account, security and transaction data for the service",
      "Sentry receives sanitized error and performance reports with default personal data collection disabled; reports may include a pseudonymous account ID when a signed-in user encounters an error",
      `Brevo sends verification, recovery and account security emails from ${authContactEmail} or a Brevo-managed sender derived from it`,
      "Google provides optional Google sign-in when the user chooses it",
      "These providers may process data only as needed to provide their services, under their own security and data processing terms"
    ]
  },
  {
    title: "Cookies and local storage",
    items: [
      "The app uses only essential cookies or browser storage needed for sign-in, account security, preferences and app functionality",
      "Vercel Web Analytics uses anonymous aggregate data without cookies or identifiers that track users across websites, while Speed Insights measures app performance",
      "The app does not use advertising cookies, tracking cookies or behavioural profiling",
      "Because no non-essential cookies are used, no marketing cookie banner is shown"
    ]
  },
  {
    title: "Data sharing",
    items: [
      "Personal data is not sold",
      "Personal data is not used for advertising",
      "Personal data is shared only with service providers needed to run the app, with authorities if legally required, or with the user when requested"
    ]
  },
  {
    title: "International transfers",
    items: [
      "Some providers may process data outside Spain or the European Economic Area",
      "When this happens, the app relies on appropriate safeguards such as adequacy decisions, standard contractual clauses or equivalent provider safeguards"
    ]
  },
  {
    title: "Retention and deletion",
    items: [
      "Account and transaction data is kept while the account exists",
      "Verification and recovery codes are temporary and expire automatically",
      "When an account is deleted, the active account, transactions, recovery data and related app data are deleted from the production database",
      "Short-lived infrastructure backups may remain only when technically unavoidable and are not used as active app data"
    ]
  },
  {
    title: "Your rights",
    items: [
      "You may request access to your personal data",
      "You may request correction of inaccurate data",
      "You may request deletion of your account and personal data",
      "You may request restriction, portability or objection where GDPR allows it",
      `You may contact ${authContactEmail} to exercise these rights`,
      "You may lodge a complaint with the Spanish Data Protection Agency or your local data protection authority"
    ]
  },
  {
    title: "Security",
    items: [
      "Passwords and recovery codes are stored as hashes, not as plain text",
      "Users are responsible for keeping passwords, recovery codes and devices secure",
      "If a security incident creates a legal notification duty, affected users and authorities will be informed as required"
    ]
  },
  {
    title: "Children",
    items: [
      "Finance Manager is not directed at children under 16",
      `If you believe a child has provided personal data without appropriate permission, contact ${authContactEmail}`
    ]
  }
];

export const termsSections: LegalNoticeSection[] = [
  {
    title: "Using the app",
    items: [
      "You may use Finance Manager to track your own personal finances",
      "You must provide accurate account information and keep your sign-in methods secure",
      "You must not misuse the app, attempt to access other accounts, overload the service, reverse engineer private systems or use the service for unlawful activity"
    ]
  },
  {
    title: "No financial advice",
    items: [
      "Finance Manager is an organisational tool, not a bank, financial adviser, tax adviser, accountant or investment service",
      "Statistics, charts and balances are generated from user-entered data and may be incomplete or inaccurate if the input data is incomplete or inaccurate",
      "Users remain responsible for financial, tax, legal and investment decisions"
    ]
  },
  {
    title: "Account access",
    items: [
      "Accounts may use email, username, Google sign-in or a combination of these methods",
      "Username accounts receive a recovery code that must be saved securely",
      "If you lose access to all recovery methods, account recovery may not be possible"
    ]
  },
  {
    title: "Availability",
    items: [
      "The app is provided as a lightweight personal finance service and may change over time",
      "The service may be interrupted for maintenance, provider issues, security reasons or technical failures",
      "No guarantee is made that the service will always be available or error free"
    ]
  },
  {
    title: "User content",
    items: [
      "Users keep ownership of the financial data they enter",
      "By using the app, users allow Finance Manager to process that data only to provide the service and related security features"
    ]
  },
  {
    title: "Project ownership",
    items: [
      "Finance Manager, its design, code, name, icons, branding and documentation are owned by Arnau Sala Araujo unless otherwise stated",
      "The source code may be visible on GitHub for transparency, development or portfolio purposes",
      "Unless a separate LICENSE file grants rights, all rights are reserved and no permission is granted to copy, modify, redistribute, sublicense or use the project commercially"
    ]
  },
  {
    title: "Account deletion",
    items: [
      "Users can delete their account from the profile area",
      "Deleting the account removes the active account and its related app data from the production database",
      "Deletion cannot be reversed"
    ]
  },
  {
    title: "Changes",
    items: [
      "The privacy policy and terms may be updated when the app, providers, legal requirements or account features change",
      "Important changes should be shown clearly in the app when reasonable"
    ]
  },
  {
    title: "Governing law",
    items: [
      "These terms are governed by Spanish law, without limiting mandatory consumer protections that may apply in the user's country"
    ]
  },
  {
    title: "Contact",
    items: ["Arnau Sala Araujo", "Barcelona, Spain", authContactEmail]
  }
];
