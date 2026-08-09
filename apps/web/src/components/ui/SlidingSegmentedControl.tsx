import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState
} from "react";
import { type LucideIcon } from "lucide-react";

export type SlidingSegmentOption<Value extends string> = {
  value: Value;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

type SlidingSegmentedControlProps<Value extends string> = {
  value: Value;
  options: readonly SlidingSegmentOption<Value>[];
  onChange: (value: Value) => void;
  label: string;
  className?: string;
  tone?: "primary" | "expense" | "income";
  compact?: boolean;
  iconOnly?: boolean;
  allowDrag?: boolean;
  disabled?: boolean;
};

type SegmentDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startIndex: number;
  maxDistance: number;
};

const DRAG_THRESHOLD = 14;

export function SlidingSegmentedControl<Value extends string>({
  value,
  options,
  onChange,
  label,
  className,
  tone = "primary",
  compact = false,
  iconOnly = false,
  allowDrag = true,
  disabled = false
}: SlidingSegmentedControlProps<Value>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<SegmentDrag | null>(null);
  const suppressClick = useRef(false);
  const optionCount = Math.max(options.length, 1);

  function select(nextValue: Value) {
    const nextOption = options.find((option) => option.value === nextValue);

    if (nextOption?.disabled) {
      return;
    }

    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  function handleClick(nextValue: Value) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    select(nextValue);
  }

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    optionIndex: number
  ) {
    if (
      disabled ||
      !allowDrag ||
      optionIndex !== selectedIndex ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const segmentWidth = (container.current?.clientWidth ?? 0) / optionCount;

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIndex: optionIndex,
      maxDistance: Math.max(0, segmentWidth - 4)
    };
    setIsDragging(true);
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = drag.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - currentDrag.startX;
    const minimumOffset =
      currentDrag.startIndex > 0 ? -currentDrag.maxDistance : 0;
    const maximumOffset =
      currentDrag.startIndex < options.length - 1
        ? currentDrag.maxDistance
        : 0;

    setDragOffset(Math.min(Math.max(distance, minimumOffset), maximumOffset));
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = drag.current;

    if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
      return;
    }

    const horizontalDistance = event.clientX - currentDrag.startX;
    const verticalDistance = event.clientY - currentDrag.startY;
    const direction = horizontalDistance > 0 ? 1 : -1;
    const nextIndex = currentDrag.startIndex + direction;
    const canMove = nextIndex >= 0 && nextIndex < options.length;
    const hasHorizontalIntent =
      Math.abs(horizontalDistance) > Math.abs(verticalDistance);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    drag.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (
      canMove &&
      hasHorizontalIntent &&
      Math.abs(horizontalDistance) >= DRAG_THRESHOLD
    ) {
      suppressClick.current = true;
      select(options[nextIndex].value);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) {
      return;
    }

    drag.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  return (
    <div
      ref={container}
      className={`sliding-segmented-control sliding-segmented-control--${tone}${
        compact ? " sliding-segmented-control--compact" : ""
      }${iconOnly ? " sliding-segmented-control--icon-only" : ""}${
        allowDrag ? "" : " sliding-segmented-control--click-only"
      }${
        isDragging ? " is-dragging" : ""
      }${className ? ` ${className}` : ""}`}
      style={
        {
          "--segmented-option-count": optionCount,
          "--segmented-option-width": `calc(${100 / optionCount}% - ${
            6 / optionCount
          }px)`,
          "--segmented-position": `${selectedIndex * 100}%`,
          "--segmented-drag-offset": `${dragOffset}px`
        } as CSSProperties
      }
      role="radiogroup"
      aria-label={label}
    >
      <span className="sliding-segmented-control__indicator" aria-hidden="true" />
      {options.map((option, index) => {
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled || option.disabled}
            role="radio"
            aria-checked={value === option.value}
            aria-label={iconOnly ? option.label : undefined}
            onClick={() => handleClick(option.value)}
            onPointerDown={(event) => startDrag(event, index)}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
          >
            {Icon ? <Icon aria-hidden="true" /> : null}
            {iconOnly ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}
