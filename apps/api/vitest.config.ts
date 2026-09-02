import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "../../coverage/api",
      include: [
        "src/pagination.ts",
        "src/money/**/*.ts",
        "src/dates/**/*.ts",
        "src/account/starting-net-worth.ts",
        "src/auth/authenticated-user.ts",
        "src/auth/auth-provider.ts",
        "src/auth/legal-acceptance.ts",
        "src/auth/password-validation.ts",
        "src/auth/recovery-code.ts",
        "src/auth/session.ts",
        "src/auth/username-validation.ts",
        "src/auth/user-validation.ts",
        "src/routes/categories.ts",
        "src/routes/feedback.ts",
        "src/services/net-worth-service.ts",
        "src/services/currency-ledger-service.ts",
        "src/services/statistics-period.ts",
        "src/services/transaction-service.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
});
