import CategoryBreakdownChart from "./CategoryBreakdownChart";
import CategoryTimelineChart from "./CategoryTimelineChart";
import IncomeExpensesChart from "./IncomeExpensesChart";
import NetWorthEvolutionChart from "./NetWorthEvolutionChart";
import PeriodBalanceChart from "./PeriodBalanceChart";
import WeekdaySpendingChart from "./WeekdaySpendingChart";

type StatsChartsViewProps = {
  mode: "MONTH" | "YEAR" | "ALL";
  selectedMonth: string;
  selectedYear: number;
};

export default function StatsChartsView(props: StatsChartsViewProps) {
  return (
    <div className="stats-charts-page">
      <NetWorthEvolutionChart {...props} />
      {props.mode !== "MONTH" ? (
        <>
          <PeriodBalanceChart
            mode={props.mode}
            selectedYear={props.selectedYear}
          />
          <IncomeExpensesChart
            mode={props.mode}
            selectedYear={props.selectedYear}
          />
        </>
      ) : null}
      <CategoryBreakdownChart {...props} />
      <CategoryTimelineChart {...props} />
      <WeekdaySpendingChart {...props} />
    </div>
  );
}
