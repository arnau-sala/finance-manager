const horizontalEdgeWidth = 20;

let isNavigationGuardInstalled = false;

export function lockAppHorizontalNavigation() {
  if (isNavigationGuardInstalled) {
    return () => undefined;
  }

  isNavigationGuardInstalled = true;

  let isBlockingEdgeGesture = false;

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) {
      isBlockingEdgeGesture = false;
      return;
    }

    const startX = event.touches[0].clientX;
    isBlockingEdgeGesture =
      startX <= horizontalEdgeWidth ||
      startX >= window.innerWidth - horizontalEdgeWidth;

    if (isBlockingEdgeGesture && event.cancelable) {
      event.preventDefault();
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (isBlockingEdgeGesture && event.cancelable) {
      event.preventDefault();
    }
  }

  function resetTouchTracking() {
    isBlockingEdgeGesture = false;
  }

  function handleWheel(event: WheelEvent) {
    if (
      Math.abs(event.deltaX) > Math.abs(event.deltaY) &&
      event.cancelable
    ) {
      event.preventDefault();
    }
  }

  window.addEventListener("touchstart", handleTouchStart, {
    capture: true,
    passive: false
  });
  window.addEventListener("touchmove", handleTouchMove, {
    capture: true,
    passive: false
  });
  window.addEventListener("touchend", resetTouchTracking, {
    capture: true,
    passive: true
  });
  window.addEventListener("touchcancel", resetTouchTracking, {
    capture: true,
    passive: true
  });
  document.addEventListener("wheel", handleWheel, {
    capture: true,
    passive: false
  });

  return () => {
    window.removeEventListener("touchstart", handleTouchStart, true);
    window.removeEventListener("touchmove", handleTouchMove, true);
    window.removeEventListener("touchend", resetTouchTracking, true);
    window.removeEventListener("touchcancel", resetTouchTracking, true);
    document.removeEventListener("wheel", handleWheel, true);
    isNavigationGuardInstalled = false;
  };
}
