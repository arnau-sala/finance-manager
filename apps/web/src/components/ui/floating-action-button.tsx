import { motion } from "framer-motion";
import { Plus, ThumbsUp } from "lucide-react";
import { useState, type ElementType, type SVGProps } from "react";

type FloatingAction = {
  label: string;
  Icon: ElementType;
};

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.24 10.24 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5.23 7.27A2.28 2.28 0 1 0 5.23 2.7a2.28 2.28 0 0 0 0 4.57ZM3.28 21.3h3.9V9.02h-3.9V21.3ZM9.54 9.02h3.74v1.68h.05c.52-.99 1.79-2.03 3.69-2.03 3.95 0 4.68 2.6 4.68 5.98v6.65h-3.89v-5.9c0-1.41-.03-3.22-1.96-3.22-1.96 0-2.26 1.53-2.26 3.12v6H9.7V9.02h-.16Z" />
    </svg>
  );
}

const actions: FloatingAction[] = [
  { label: "LinkedIn", Icon: LinkedinIcon },
  { label: "GitHub", Icon: GithubIcon },
  { label: "Feedback", Icon: ThumbsUp }
];

const buttonSize = 56;
const buttonGap = 12;
const expandedWidth =
  buttonSize * (actions.length + 1) + buttonGap * actions.length;
const mainButtonOffset = expandedWidth - buttonSize;

const smoothTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1]
} as const;

export function LandingFloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`landing-floating-actions${
        isOpen ? " is-open" : " is-closed"
      }`}
      style={{ width: expandedWidth }}
      aria-label="Landing actions"
    >
      <div className="landing-floating-actions__actions" aria-hidden={!isOpen}>
        {actions.map(({ label, Icon }, index) => (
          <motion.button
            key={label}
            className="landing-floating-actions__action"
            type="button"
            aria-label={label}
            tabIndex={isOpen ? 0 : -1}
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
              filter: isOpen ? "blur(0px)" : "blur(3px)",
              scale: isOpen ? 1 : 0.88,
              rotate: isOpen ? 0 : 45
            }}
            transition={{
              duration: 0.42,
              ease: [0.22, 1, 0.36, 1],
              delay: isOpen ? 0.08 + index * 0.035 : index * 0.025
            }}
          >
            <Icon aria-hidden="true" strokeWidth={1.8} />
          </motion.button>
        ))}
      </div>

      <motion.div
        className="landing-floating-actions__trigger-track"
        initial={false}
        animate={{ x: isOpen ? -mainButtonOffset : 0 }}
        transition={smoothTransition}
      >
        <button
          className="landing-floating-actions__trigger"
          type="button"
          aria-label={
            isOpen ? "Collapse landing actions" : "Expand landing actions"
          }
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <motion.span
            className="landing-floating-actions__trigger-icon"
            initial={false}
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={smoothTransition}
          >
            <Plus aria-hidden="true" strokeWidth={2.4} />
          </motion.span>
        </button>
      </motion.div>
    </div>
  );
}
