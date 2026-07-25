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
};

export function EChart({ option, className, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

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

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.setOption(option, {
      notMerge: true,
      lazyUpdate: false
    });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
