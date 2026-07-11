import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const SWIPE_START_AREA = 40;
const SWIPE_DISTANCE = 72;

export function useBackSwipe(onBack: () => void) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch" && event.clientX <= SWIPE_START_AREA) {
      swipeStart.current = { x: event.clientX, y: event.clientY };
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;

    if (!start || event.pointerType !== "touch") {
      return;
    }

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = Math.abs(event.clientY - start.y);

    if (
      horizontalDistance >= SWIPE_DISTANCE &&
      horizontalDistance > verticalDistance * 1.2
    ) {
      onBack();
    }
  }

  function handlePointerCancel() {
    swipeStart.current = null;
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel
  };
}
