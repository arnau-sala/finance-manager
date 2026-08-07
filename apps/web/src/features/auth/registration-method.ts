export type RegistrationMethod = "email" | "username" | "google";
export type CredentialRegistrationMethod = Exclude<
  RegistrationMethod,
  "google"
>;
