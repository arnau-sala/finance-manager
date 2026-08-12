process.env.NODE_ENV = "test";
process.env.SESSION_KEY ??= "0".repeat(64);
process.env.ALLOWED_ORIGINS ??= "http://localhost:5173";
process.env.DATABASE_URL ??=
  "postgresql://test:test@127.0.0.1:5432/finance_manager_test";
