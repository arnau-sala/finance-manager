import NetWorthEvolutionChart from "./NetWorthEvolutionChart";
import PeriodBalanceChart from "./PeriodBalanceChart";

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
        <PeriodBalanceChart
          mode={props.mode}
          selectedYear={props.selectedYear}
        />
      ) : null}
    </div>
  );
}
