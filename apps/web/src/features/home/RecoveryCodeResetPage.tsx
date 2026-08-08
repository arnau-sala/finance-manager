import {
  activateRecoveryCodeReset,
  ApiRequestError,
  type RecoveryCodeResetResult
} from "../auth/auth-api";
import { RecoveryCodePage } from "../auth/RecoveryCodePage";

type RecoveryCodeResetPageProps = {
  result: RecoveryCodeResetResult | null;
  onDone: () => void;
  onSessionExpired: () => void;
};

export function RecoveryCodeResetPage({
  result,
  onDone,
  onSessionExpired
}: RecoveryCodeResetPageProps) {
  const open = result !== null;

  async function activateAndClose() {
    if (!result) {
      return;
    }

    try {
      await activateRecoveryCodeReset(result.rotationToken);
      onDone();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        onSessionExpired();
      }

      throw error;
    }
  }

  return (
    <div
      className={`account-flow-layer recovery-code-reset-layer${
        open ? " is-open" : ""
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      {result ? (
        <RecoveryCodePage
          username={result.username}
          recoveryCode={result.recoveryCode}
          context="recovery-reset"
          onContinue={activateAndClose}
        />
      ) : null}
    </div>
  );
}
