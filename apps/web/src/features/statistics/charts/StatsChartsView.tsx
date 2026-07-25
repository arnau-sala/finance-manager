import NetWorthEvolutionChart from "./NetWorthEvolutionChart";

type StatsChartsViewProps = {
  mode: "MONTH" | "YEAR" | "ALL";
  selectedMonth: string;
  selectedYear: number;
};

export default function StatsChartsView(props: StatsChartsViewProps) {
  return (
    <div className="stats-charts-page">
      <NetWorthEvolutionChart {...props} />
    </div>
  );
}
