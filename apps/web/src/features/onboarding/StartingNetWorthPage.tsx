import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { Landmark } from "lucide-react";

import {
  ApiRequestError,
  type SessionUser
} from "../auth/auth-api";
import {
  saveStartingNetWorth,
  skipStartingNetWorth
} from "./starting-net-worth-api";
import {
  isEditableStartingNetWorth,
  parseStartingNetWorth,
  STARTING_NET_WORTH_ERROR
} from "./starting-net-worth-validation";

type StartingNetWorthPageProps = {
  onComplete: (user: SessionUser) => void;
  onSessionExpired: () => void;
};

type PendingAction = "SAVE" | "SKIP" | null;

export function StartingNetWorthPage({
  onComplete,
  onSessionExpired
}: StartingNetWorthPageProps) {
  const [amount, setAmount] = useState("");
  const [amountFieldWidth, setAmountFieldWidth] = useState(52);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountMeasureRef = useRef<HTMLSpanElement>(null);
  const parsedAmount = parseStartingNetWorth(amount);
  const isPending = pendingAction !== null;

  useLayoutEffect(() => {
    let cancelled = false;

    function updateAmountWidth() {
      if (cancelled || !amountMeasureRef.current) {
        return;
      }

      const measuredWidth = amountMeasureRef.current.getBoundingClientRect().width;
      setAmountFieldWidth(Math.ceil(measuredWidth) + 32);

      requestAnimationFrame(() => {
        if (amountInputRef.current) {
          amountInputRef.current.scrollLeft = 0;
        }
      });
    }

    updateAmountWidth();
    void document.fonts?.ready.then(updateAmountWidth);

    return () => {
      cancelled = true;
    };
  }, [amount]);

  async function finishRequest(request: () => Promise<SessionUser>) {
    try {
      const user = await request();
      onComplete(user);
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          onSessionExpired();
          return;
        }

        setError(requestError.message);
        return;
      }

      setError("Unable to finish account setup. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  function submitStartingNetWorth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (parsedAmount === null || isPending) {
      setError(STARTING_NET_WORTH_ERROR);
      return;
    }

    setError(null);
    setPendingAction("SAVE");
    void finishRequest(() => saveStartingNetWorth(parsedAmount));
  }

  function skipSetup() {
    if (isPending) {
      return;
    }

    setError(null);
    setPendingAction("SKIP");
    void finishRequest(skipStartingNetWorth);
  }

  return (
    <main className="starting-net-worth-screen">
      <header className="starting-net-worth-screen__topbar">
        <span>Account setup</span>
        <button
          type="button"
          disabled={isPending}
          onClick={skipSetup}
        >
          {pendingAction === "SKIP" ? "Skipping..." : "Skip for now"}
        </button>
      </header>

      <section
        className="starting-net-worth-panel"
        aria-labelledby="starting-net-worth-title"
      >
        <span className="starting-net-worth-panel__icon" aria-hidden="true">
          <Landmark />
        </span>

        <div className="starting-net-worth-panel__heading">
          <p>Your financial starting point</p>
          <h1 id="starting-net-worth-title">Set your starting net worth</h1>
          <p>
            Enter what you own minus what you owe today. We will use it as
            your baseline and track changes from future transactions.
          </p>
        </div>

        <form
          className="starting-net-worth-form"
          onSubmit={submitStartingNetWorth}
          noValidate
        >
          <label htmlFor="starting-net-worth-amount">Current net worth</label>
          <div
            className={`starting-net-worth-form__amount${
              error ? " is-invalid" : ""
            }${amount.length > 8 ? " is-compact" : ""}${
              amount.length > 10 ? " is-extra-compact" : ""
            }`}
          >
            <span
              className="starting-net-worth-form__amount-value"
              style={{ width: `${amountFieldWidth}px` }}
            >
              <span
                ref={amountMeasureRef}
                className="starting-net-worth-form__amount-measure"
                aria-hidden="true"
              >
                {amount || "0"}
              </span>
              <input
                ref={amountInputRef}
                id="starting-net-worth-amount"
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                maxLength={12}
                value={amount}
                placeholder="0"
                aria-invalid={Boolean(error)}
                aria-describedby="starting-net-worth-help starting-net-worth-error"
                onChange={(event) => {
                  const nextAmount = event.target.value;

                  if (isEditableStartingNetWorth(nextAmount)) {
                    setAmount(nextAmount);
                    setError(null);
                  }
                }}
                onBlur={() => {
                  requestAnimationFrame(() => {
                    if (amountInputRef.current) {
                      amountInputRef.current.scrollLeft = 0;
                    }
                  });

                  if (amount && parsedAmount === null) {
                    setError(STARTING_NET_WORTH_ERROR);
                  }
                }}
              />
            </span>
            <span
              className="starting-net-worth-form__amount-currency"
              aria-hidden="true"
            >
              €
            </span>
          </div>

          <p
            id="starting-net-worth-help"
            className="starting-net-worth-form__help"
          >
            Net worth insights stay unavailable if you skip this step.
          </p>
          <p
            id="starting-net-worth-error"
            className="starting-net-worth-form__error"
            role={error ? "alert" : undefined}
          >
            {error ?? ""}
          </p>

          <button
            className="starting-net-worth-form__submit"
            type="submit"
            disabled={parsedAmount === null || isPending}
          >
            {pendingAction === "SAVE" ? "Saving..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
