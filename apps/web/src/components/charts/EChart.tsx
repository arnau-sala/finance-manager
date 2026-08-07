import { useEffect, useRef } from "react";

import {
  init,
  type EChartsCoreOption,
  type EChartsType
} from "./chart-engine";

type EChartProps = {
  option: EChartsCoreOption;
  className?: string;
  ariaLabel: string;
  toggleItemSelectionOnClick?: boolean;
  highlightSelectedItemOnClick?: boolean;
  onItemSelectionChange?: (dataIndex: number | null) => void;
  mergeOptionUpdates?: boolean;
  hideTooltip?: boolean;
  arbitrateTouchScroll?: boolean;
  onAxisPointerSelection?: (
    value: string | number | null
  ) => boolean | void;
};

type SelectedChartItem = {
  seriesIndex: number;
  dataIndex: number;
};

export function EChart({
  option,
  className,
  ariaLabel,
  toggleItemSelectionOnClick = false,
  highlightSelectedItemOnClick = true,
  onItemSelectionChange,
  mergeOptionUpdates = false,
  hideTooltip = false,
  arbitrateTouchScroll = false,
  onAxisPointerSelection
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const selectedItemRef = useRef<SelectedChartItem | null>(null);
  const highlightSelectedItemRef = useRef(highlightSelectedItemOnClick);
  const onItemSelectionChangeRef = useRef(onItemSelectionChange);

  useEffect(() => {
    highlightSelectedItemRef.current = highlightSelectedItemOnClick;
    onItemSelectionChangeRef.current = onItemSelectionChange;
  }, [highlightSelectedItemOnClick, onItemSelectionChange]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = init(container, undefined, { renderer: "svg" });
    chartRef.current = chart;

    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);

      if (
        nextWidth === chart.getWidth() &&
        nextHeight === chart.getHeight()
      ) {
        return;
      }

      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => chart.resize());
    });
    resizeObserver.observe(container);

    const dismissInteraction = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && !container.contains(target)) {
        const selectedItem = selectedItemRef.current;

        if (selectedItem && highlightSelectedItemRef.current) {
          chart.dispatchAction({
            type: "downplay",
            ...selectedItem
          });
        }

        if (selectedItem) {
          selectedItemRef.current = null;
          onItemSelectionChangeRef.current?.(null);
        }

        chart.dispatchAction({
          type: "hideTip"
        });
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave"
        });
      }
    };
    document.addEventListener("pointerdown", dismissInteraction, true);

    return () => {
      document.removeEventListener("pointerdown", dismissInteraction, true);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const chart = chartRef.current;

    if (!container || !chart || !arbitrateTouchScroll) {
      return;
    }

    const movementThreshold = 8;
    const tooltipHoldDelay = 180;
    let touchActive = false;
    let scrollGesture = false;
    let chartGesture = false;
    let tooltipVisible = false;
    let tooltipShownAt: number | null = null;
    let hideTooltipTimer: number | null = null;
    let startX = 0;
    let startY = 0;

    const hideTooltipForScroll = () => {
      tooltipVisible = false;
      tooltipShownAt = null;
      chart.dispatchAction({ type: "hideTip" });
      chart.dispatchAction({
        type: "updateAxisPointer",
        currTrigger: "leave"
      });

      if (hideTooltipTimer !== null) {
        window.clearTimeout(hideTooltipTimer);
      }

      hideTooltipTimer = window.setTimeout(() => {
        hideTooltipTimer = null;

        if (scrollGesture) {
          chart.dispatchAction({ type: "hideTip" });
          chart.dispatchAction({
            type: "updateAxisPointer",
            currTrigger: "leave"
          });
        }
      }, 0);
    };

    const handleShowTip = () => {
      if (scrollGesture) {
        hideTooltipForScroll();
        return;
      }

      tooltipVisible = true;

      if (touchActive && tooltipShownAt === null) {
        tooltipShownAt = performance.now();
      }
    };

    const handleHideTip = () => {
      tooltipVisible = false;
      tooltipShownAt = null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touch || event.touches.length !== 1) {
        touchActive = false;
        return;
      }

      touchActive = true;
      scrollGesture = false;
      chartGesture = false;
      startX = touch.clientX;
      startY = touch.clientY;
      tooltipShownAt = tooltipVisible ? performance.now() : null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touchActive || !touch || event.touches.length !== 1) {
        return;
      }

      if (chartGesture) {
        event.preventDefault();
        return;
      }

      if (scrollGesture) {
        return;
      }

      const deltaX = Math.abs(touch.clientX - startX);
      const deltaY = Math.abs(touch.clientY - startY);
      const tooltipWasHeld =
        tooltipShownAt !== null &&
        performance.now() - tooltipShownAt >= tooltipHoldDelay;

      if (
        tooltipWasHeld ||
        (deltaX >= movementThreshold && deltaX > deltaY)
      ) {
        chartGesture = true;
        event.preventDefault();
        return;
      }

      if (deltaY >= movementThreshold && deltaY >= deltaX) {
        scrollGesture = true;
        hideTooltipForScroll();
      }
    };

    const finishTouch = () => {
      touchActive = false;
      scrollGesture = false;
      chartGesture = false;
      tooltipShownAt = null;
    };

    chart.on("showTip", handleShowTip);
    chart.on("hideTip", handleHideTip);
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });
    container.addEventListener("touchend", finishTouch, { passive: true });
    container.addEventListener("touchcancel", finishTouch, { passive: true });

    return () => {
      if (hideTooltipTimer !== null) {
        window.clearTimeout(hideTooltipTimer);
      }

      chart.off("showTip", handleShowTip);
      chart.off("hideTip", handleHideTip);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", finishTouch);
      container.removeEventListener("touchcancel", finishTouch);
    };
  }, [arbitrateTouchScroll]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || !toggleItemSelectionOnClick) {
      return;
    }

    const handleItemClick = (rawEvent: unknown) => {
      if (
        typeof rawEvent !== "object" ||
        rawEvent === null ||
        !("seriesIndex" in rawEvent) ||
        !("dataIndex" in rawEvent)
      ) {
        return;
      }

      const seriesIndex = Number(rawEvent.seriesIndex);
      const dataIndex = Number(rawEvent.dataIndex);

      if (!Number.isInteger(seriesIndex) || !Number.isInteger(dataIndex)) {
        return;
      }

      const selectedItem = selectedItemRef.current;
      const isSameItem =
        selectedItem?.seriesIndex === seriesIndex &&
        selectedItem.dataIndex === dataIndex;

      if (selectedItem && highlightSelectedItemOnClick) {
        chart.dispatchAction({
          type: "downplay",
          ...selectedItem
        });
      }

      if (isSameItem) {
        chart.dispatchAction({ type: "hideTip" });
        selectedItemRef.current = null;
        onItemSelectionChange?.(null);
        return;
      }

      const nextItem = { seriesIndex, dataIndex };

      if (highlightSelectedItemOnClick) {
        chart.dispatchAction({
          type: "highlight",
          ...nextItem
        });
      }

      chart.dispatchAction({
        type: "showTip",
        ...nextItem
      });
      selectedItemRef.current = nextItem;
      onItemSelectionChange?.(dataIndex);
    };

    chart.on("click", handleItemClick);

    return () => {
      chart.off("click", handleItemClick);
    };
  }, [
    highlightSelectedItemOnClick,
    onItemSelectionChange,
    toggleItemSelectionOnClick
  ]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || !onAxisPointerSelection) {
      return;
    }

    const handleAxisPointer = (rawEvent: unknown) => {
      const axesInfo =
        typeof rawEvent === "object" &&
        rawEvent !== null &&
        "axesInfo" in rawEvent &&
        Array.isArray(rawEvent.axesInfo)
          ? rawEvent.axesInfo
          : [];
      const firstAxis = axesInfo[0];
      const value =
        typeof firstAxis === "object" &&
        firstAxis !== null &&
        "value" in firstAxis &&
        (typeof firstAxis.value === "string" ||
          typeof firstAxis.value === "number")
          ? firstAxis.value
          : null;
      const keepSelection = onAxisPointerSelection(value);

      if (value !== null && keepSelection === false) {
        chart.dispatchAction({ type: "hideTip" });
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave"
        });
      }
    };

    chart.on("updateAxisPointer", handleAxisPointer);

    return () => {
      chart.off("updateAxisPointer", handleAxisPointer);
    };
  }, [onAxisPointerSelection]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    if (!mergeOptionUpdates) {
      selectedItemRef.current = null;
    }

    chart.setOption(option, {
      notMerge: !mergeOptionUpdates,
      lazyUpdate: false
    });
  }, [mergeOptionUpdates, option]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || !hideTooltip) {
      return;
    }

    const selectedItem = selectedItemRef.current;

    if (selectedItem && highlightSelectedItemRef.current) {
      chart.dispatchAction({
        type: "downplay",
        ...selectedItem
      });
    }

    selectedItemRef.current = null;
    chart.dispatchAction({ type: "hideTip" });
    chart.dispatchAction({
      type: "updateAxisPointer",
      currTrigger: "leave"
    });
  }, [hideTooltip, option]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
