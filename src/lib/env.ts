const JWT_SECRET_MIN_LENGTH = 32;

/** Fail fast so login/signToken doesn’t throw opaque HTTP 500s. */
export function assertRequiredEnv(): void {
  const missing: string[] = [];
  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt) missing.push("JWT_SECRET");
  else if (jwt.length < JWT_SECRET_MIN_LENGTH) {
    console.error(
      `[env] JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters (use a long random string, e.g. openssl rand -hex 32).`,
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGIN?.trim()) {
    missing.push("FRONTEND_ORIGIN (required in production for CORS)");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SMTP_HOST?.trim() &&
    !process.env.SMTP_FROM?.trim()
  ) {
    missing.push("SMTP_FROM (required in production when SMTP_HOST is set)");
  }
  if (missing.length === 0) return;
  console.error(
    `[env] Missing required variables: ${missing.join(", ")}. Copy .env.example to .env and set values.`,
  );
  process.exit(1);
}
