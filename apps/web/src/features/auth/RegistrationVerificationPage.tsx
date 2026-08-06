import { EmailVerificationPage } from "./EmailVerificationPage";
import {
  resendRegistrationCode,
  verifyRegistrationCode
} from "./registration-api";

type RegistrationVerificationPageProps = {
  email: string;
  onBack: () => void;
  onVerified: () => void | Promise<void>;
};

export function RegistrationVerificationPage({
  email,
  onBack,
  onVerified
}: RegistrationVerificationPageProps) {
  return (
    <EmailVerificationPage
      email={email}
      idPrefix="registration-verification"
      title="Check your email"
      verifyLabel="Verify account"
      onBack={onBack}
      onResendCode={() => resendRegistrationCode(email)}
      onVerifyCode={async (code) => {
        await verifyRegistrationCode(email, code);
        await onVerified();
      }}
    />
  );
}
