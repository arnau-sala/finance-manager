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
  mergeOptionUpdates?: boolean;
  hideTooltip?: boolean;
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
  mergeOptionUpdates = false,
  hideTooltip = false,
  onAxisPointerSelection
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const selectedItemRef = useRef<SelectedChartItem | null>(null);

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

        if (selectedItem) {
          chart.dispatchAction({
            type: "downplay",
            ...selectedItem
          });
          selectedItemRef.current = null;
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

      if (selectedItem) {
        chart.dispatchAction({
          type: "downplay",
          ...selectedItem
        });
      }

      if (isSameItem) {
        chart.dispatchAction({ type: "hideTip" });
        selectedItemRef.current = null;
        return;
      }

      const nextItem = { seriesIndex, dataIndex };
      chart.dispatchAction({
        type: "highlight",
        ...nextItem
      });
      chart.dispatchAction({
        type: "showTip",
        ...nextItem
      });
      selectedItemRef.current = nextItem;
    };

    chart.on("click", handleItemClick);

    return () => {
      chart.off("click", handleItemClick);
    };
  }, [toggleItemSelectionOnClick]);

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

    selectedItemRef.current = null;
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
