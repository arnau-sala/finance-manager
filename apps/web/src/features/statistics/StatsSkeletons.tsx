import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import type { StatisticsPeriodMode } from "./statistics-api";

function StatsSkeletonRows({
  count,
  columns = "standard"
}: {
  count: number;
  columns?: "standard" | "compact";
}) {
  return (
    <ul
      className={`stats-skeleton-rows stats-skeleton-rows--${columns}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <SkeletonBlock width={18} height={18} radius={4} />
          <SkeletonBlock
            width={`${68 - (index % 3) * 9}%`}
            height={13}
          />
          {columns === "standard" ? (
            <SkeletonBlock width={48} height={11} />
          ) : null}
          <SkeletonBlock width={58} height={16} />
        </li>
      ))}
    </ul>
  );
}

export function StatsOverviewSkeleton() {
  return (
    <div
      className="stats-sections stats-sections--skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading statistics</span>

      <section className="stats-money" aria-hidden="true">
        <SkeletonBlock width={58} height={19} />
        <div className="stats-money__content stats-money__content--skeleton">
          <div className="stats-money__balance">
            <SkeletonBlock width={92} height={14} />
            <SkeletonBlock width="76%" height={30} radius={5} />
            <SkeletonBlock width={86} height={12} />
          </div>
          <div className="stats-money__breakdown">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index}>
                <SkeletonBlock width={66} height={13} />
                <SkeletonBlock width={62} height={16} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-categories" aria-hidden="true">
        <SkeletonBlock width={88} height={19} />
        <SkeletonBlock
          className="stats-skeleton__segmented-control"
          width="100%"
          height={40}
          radius={11}
        />
        <StatsSkeletonRows count={6} />
      </section>

      <section className="stats-insights" aria-hidden="true">
        <SkeletonBlock width={66} height={19} />
        <StatsSkeletonRows count={5} />
      </section>

      <section className="stats-expenses" aria-hidden="true">
        <SkeletonBlock width={74} height={19} />
        <StatsSkeletonRows count={4} columns="compact" />
      </section>
    </div>
  );
}

export function StatsInitialSkeleton() {
  return (
    <div className="stats-page stats-page--skeleton">
      <header className="stats-page__header">
        <h1 id="stats-page-title">Stats</h1>
        <SkeletonBlock width={82} height={40} radius={11} />
      </header>

      <SkeletonBlock width="100%" height={40} radius={11} />

      <div className="stats-initial-skeleton__period" aria-hidden="true">
        <SkeletonBlock width={42} height={42} radius="50%" />
        <SkeletonBlock width={116} height={16} />
        <SkeletonBlock width={42} height={42} radius="50%" />
      </div>

      <div className="stats-initial-skeleton__content">
        <StatsOverviewSkeleton />
      </div>
    </div>
  );
}

export function StatsChartsSkeleton({
  mode
}: {
  mode: StatisticsPeriodMode;
}) {
  const heights =
    mode === "MONTH"
      ? [270, 118, 220, 270]
      : [270, 270, 118, 220, 270];

  return (
    <div
      className="stats-charts-page stats-charts-page--skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading charts</span>
      {heights.map((height, index) => (
        <section className="stats-chart-section" key={`${height}-${index}`}>
          <header className="stats-chart-section__header" aria-hidden="true">
            <SkeletonBlock width={118} height={18} />
            <SkeletonBlock width={96} height={11} />
          </header>
          <SkeletonBlock width="100%" height={height} radius={6} />
        </section>
      ))}
    </div>
  );
}
