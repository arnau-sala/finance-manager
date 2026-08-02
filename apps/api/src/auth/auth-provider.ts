import type { AuthProvider } from "@prisma/client";

export function supportsPasswordAuthentication(provider: AuthProvider) {
  return provider === "PASSWORD" || provider === "PASSWORD_AND_GOOGLE";
}

export function supportsGoogleAuthentication(provider: AuthProvider) {
  return provider === "GOOGLE" || provider === "PASSWORD_AND_GOOGLE";
}
