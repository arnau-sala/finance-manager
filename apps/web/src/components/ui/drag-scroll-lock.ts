const DRAG_SCROLL_LOCK_CLASS = "segmented-drag-scroll-lock";
const DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE = "data-segmented-drag-scroll-lock-count";

export function acquireDragScrollLock() {
  const currentCount = Number(
    document.body.getAttribute(DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE) ?? "0"
  );
  const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;

  document.body.setAttribute(
    DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE,
    String(nextCount)
  );
  document.body.classList.add(DRAG_SCROLL_LOCK_CLASS);

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;

    const count = Number(
      document.body.getAttribute(DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE) ?? "1"
    );
    const next = Math.max(0, Number.isFinite(count) ? count - 1 : 0);

    if (next === 0) {
      document.body.removeAttribute(DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE);
      document.body.classList.remove(DRAG_SCROLL_LOCK_CLASS);
      return;
    }

    document.body.setAttribute(
      DRAG_SCROLL_LOCK_COUNT_ATTRIBUTE,
      String(next)
    );
  };
}
