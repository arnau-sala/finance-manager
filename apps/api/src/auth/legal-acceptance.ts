export const currentLegalVersion = "2026-08-09";

export function createLegalAcceptance() {
  return {
    legalAcceptedAt: new Date(),
    legalAcceptedVersion: currentLegalVersion,
  };
}
