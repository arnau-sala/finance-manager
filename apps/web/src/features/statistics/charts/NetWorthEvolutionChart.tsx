import type { StatisticsCharts } from "../statistics-api";

type NetWorthEvolutionChartProps = {
  periodStart: string;
  periodEnd: string;
  netWorth: StatisticsCharts["netWorth"];
};

const periodDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function formatDate(date: string) {
  return periodDateFormatter.format(
    new Date(`${date}T00:00:00.000Z`)
  );
}

export default function NetWorthEvolutionChart({
  periodStart,
  periodEnd,
  netWorth
}: NetWorthEvolutionChartProps) {
  const displayedPeriod = `${formatDate(periodStart)} - ${formatDate(
    periodEnd
  )}`;

  return (
    <section
      className="stats-chart-section stats-net-worth"
      aria-labelledby="net-worth-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="net-worth-chart-title">Net Worth Evolution</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      {netWorth.status === "OPENING_BALANCE_REQUIRED" ? (
        <div className="stats-chart-unavailable">
          <strong>Starting net worth required</strong>
          <span>This chart will appear after your starting balance is set.</span>
        </div>
      ) : null}
    </section>
  );
}
