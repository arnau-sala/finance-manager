import { useMemo } from "react";

import type { StatisticsCharts } from "../statistics-api";
import CashFlowChart from "./CashFlowChart";
import CategoryBreakdownChart from "./CategoryBreakdownChart";
import CategoryTimelineChart from "./CategoryTimelineChart";
import NetWorthEvolutionChart from "./NetWorthEvolutionChart";
import { createFinancialIntervals } from "./statistics-chart-periods";
import WeekdaySpendingChart from "./WeekdaySpendingChart";

type StatsChartsViewProps = {
  charts: StatisticsCharts;
};

export default function StatsChartsView({ charts }: StatsChartsViewProps) {
  const { period } = charts;
  const aggregateMode = period.mode === "ALL" ? "ALL" : "YEAR";
  const financialIntervals = useMemo(
    () =>
      period.mode === "MONTH"
        ? []
        : createFinancialIntervals(
            aggregateMode,
            charts.financialIntervals
          ),
    [aggregateMode, charts.financialIntervals, period.mode]
  );

  return (
    <div className="stats-charts-page">
      <NetWorthEvolutionChart
        mode={period.mode}
        periodStart={period.startDate}
        periodEnd={period.endDate}
        netWorth={charts.netWorth}
      />
      {period.mode !== "MONTH" ? (
        <CashFlowChart
          mode={aggregateMode}
          intervals={financialIntervals}
        />
      ) : null}
      <CategoryBreakdownChart
        mode={period.mode}
        periodStart={period.startDate}
        periodEnd={period.endDate}
        categories={charts.categories}
      />
      <CategoryTimelineChart
        mode={period.mode}
        periodStart={period.startDate}
        periodEnd={period.endDate}
        categories={charts.categories}
        timeline={charts.categoryTimeline}
      />
      <WeekdaySpendingChart
        mode={period.mode}
        periodStart={period.startDate}
        periodEnd={period.endDate}
        spending={charts.weekdaySpending}
      />
    </div>
  );
}
