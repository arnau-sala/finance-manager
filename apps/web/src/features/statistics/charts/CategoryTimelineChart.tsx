import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { SlidingSegmentedControl } from "../../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  getCategoryIcon,
  type TransactionType
} from "../../transactions/category-catalog";
import {
  getDefaultCategoryType,
  getVisibleCategoryBreakdown,
  type CategoryBreakdownItem
} from "../statistics-categories";
import { createCategoryTypeOptions } from "../statistics-category-switch";
import type {
  StatisticsCharts,
  StatisticsPeriodMode
} from "../statistics-api";

type TimelineCategory = CategoryBreakdownItem & {
  type: TransactionType;
};

type CategoryTimelineChartProps = {
  mode: StatisticsPeriodMode;
  periodStart: string;
  periodEnd: string;
  categories: readonly TimelineCategory[];
  timeline: StatisticsCharts["categoryTimeline"];
};

type TimelineInterval = {
  key: string;
  axisLabel: string;
  detailLabel: string;
  startDate: string;
  endDate: string;
};

type TimelineCell = {
  key: string;
  category: CategoryBreakdownItem;
  interval: TimelineInterval;
  amount: number;
  percentage: number;
  intensity: number;
};

type TimelineRow = {
  category: CategoryBreakdownItem;
  cells: TimelineCell[];
};

const INTENSITY_LEVELS = [1, 2, 3, 4, 5] as const;
const TIMELINE_CELL_SIZE = 20;
const periodDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC"
});

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDisplayedPeriod(startDate: string, endDate: string) {
  return `${periodDateFormatter.format(
    toUtcDate(startDate)
  )} - ${periodDateFormatter.format(toUtcDate(endDate))}`;
}

function createIntervals(
  mode: StatisticsPeriodMode,
  intervals: StatisticsCharts["categoryTimeline"]["intervals"]
) {
  return intervals.map<TimelineInterval>((interval) => ({
    key: interval.key,
    axisLabel:
      mode === "YEAR"
        ? shortMonthFormatter.format(toUtcDate(interval.startDate))
        : interval.label,
    detailLabel:
      mode === "MONTH"
        ? `${Number(interval.startDate.slice(-2))}-${Number(
            interval.endDate.slice(-2)
          )} ${monthFormatter.format(toUtcDate(interval.startDate))}`
        : mode === "YEAR"
          ? monthFormatter.format(toUtcDate(interval.startDate))
          : interval.label,
    startDate: interval.startDate,
    endDate: interval.endDate
  }));
}

function getIntensity(amount: number, maximumAmount: number) {
  if (amount <= 0 || maximumAmount <= 0) {
    return 0;
  }

  return Math.min(
    5,
    Math.max(1, Math.ceil(Math.sqrt(amount / maximumAmount) * 5))
  );
}

function createTimelineRows(
  categories: readonly CategoryBreakdownItem[],
  intervals: readonly TimelineInterval[],
  sourceCells: StatisticsCharts["categoryTimeline"]["cells"],
  type: TransactionType
) {
  const otherId = `${type.toLowerCase()}-other`;
  const directCategoryIds = new Set(
    categories
      .filter((category) => category.id !== otherId)
      .map((category) => category.id)
  );
  const amountsByCell = new Map<string, number>();
  const intervalTotals = new Map<string, number>();

  sourceCells
    .filter((cell) => cell.type === type)
    .forEach((cell) => {
      intervalTotals.set(
        cell.intervalKey,
        (intervalTotals.get(cell.intervalKey) ?? 0) + cell.amount
      );
      const categoryId = directCategoryIds.has(cell.categoryId)
        ? cell.categoryId
        : otherId;
      const key = `${categoryId}:${cell.intervalKey}`;
      amountsByCell.set(key, (amountsByCell.get(key) ?? 0) + cell.amount);
    });

  const maximumAmount = Math.max(0, ...amountsByCell.values());

  return categories.map<TimelineRow>((category) => ({
    category,
    cells: intervals.map((interval) => {
      const amount =
        amountsByCell.get(`${category.id}:${interval.key}`) ?? 0;
      const intervalTotal = intervalTotals.get(interval.key) ?? 0;

      return {
        key: `${category.id}:${interval.key}`,
        category,
        interval,
        amount,
        percentage:
          intervalTotal > 0 ? (amount * 100) / intervalTotal : 0,
        intensity: getIntensity(amount, maximumAmount)
      };
    })
  }));
}

function formatPercentage(value: number) {
  if (value > 0 && value < 1) {
    return "<1%";
  }

  return `${Math.round(value)}%`;
}

export default function CategoryTimelineChart({
  mode,
  periodStart,
  periodEnd,
  categories: sourceCategories,
  timeline
}: CategoryTimelineChartProps) {
  const interactionRef = useRef<HTMLDivElement>(null);
  const typeByPeriodRef = useRef<Map<string, TransactionType>>(new Map());
  const previousModeRef = useRef<StatisticsPeriodMode>(mode);
  const periodCacheKey = `${mode}:${periodStart}:${periodEnd}`;
  const defaultType = useMemo(
    () => getDefaultCategoryType(sourceCategories),
    [sourceCategories]
  );
  const [type, setType] = useState<TransactionType>(defaultType);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(
    null
  );
  const categoryTypeOptions = useMemo(
    () => createCategoryTypeOptions(sourceCategories),
    [sourceCategories]
  );
  const intervals = useMemo(
    () => createIntervals(mode, timeline.intervals),
    [mode, timeline.intervals]
  );
  const categories = useMemo(
    () =>
      getVisibleCategoryBreakdown(
        sourceCategories.filter((category) => category.type === type),
        type
      ),
    [sourceCategories, type]
  );
  const rows = useMemo(
    () =>
      createTimelineRows(
        categories,
        intervals,
        timeline.cells,
        type
      ),
    [categories, intervals, timeline.cells, type]
  );
  const selectedCell =
    rows
      .flatMap((row) => row.cells)
      .find((cell) => cell.key === selectedCellKey) ?? null;
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(periodStart, periodEnd),
    [periodEnd, periodStart]
  );
  const matrixStyle = {
    "--timeline-columns": rows.length,
    "--timeline-cell-size": `${TIMELINE_CELL_SIZE}px`,
    "--timeline-label-width":
      mode === "MONTH" ? "42px" : mode === "YEAR" ? "26px" : "32px"
  } as CSSProperties;

  useEffect(() => {
    if (previousModeRef.current !== mode) {
      typeByPeriodRef.current.clear();
      previousModeRef.current = mode;
    }

    const cachedType = typeByPeriodRef.current.get(periodCacheKey);
    const cachedOption = categoryTypeOptions.find(
      (option) => option.value === cachedType
    );

    setType((currentType) => {
      const currentOption = categoryTypeOptions.find(
        (option) => option.value === currentType
      );

      if (cachedType && !cachedOption?.disabled) {
        return cachedType;
      }

      if (currentOption?.disabled || currentType !== defaultType) {
        return defaultType;
      }

      return currentType;
    });
  }, [categoryTypeOptions, defaultType, mode, periodCacheKey]);

  useEffect(() => {
    setSelectedCellKey(null);
  }, [mode, periodEnd, periodStart, type]);

  useEffect(() => {
    if (selectedCellKey === null) {
      return;
    }

    const dismissSelection = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !interactionRef.current?.contains(target)
      ) {
        setSelectedCellKey(null);
      }
    };

    document.addEventListener("pointerdown", dismissSelection, true);

    return () => {
      document.removeEventListener(
        "pointerdown",
        dismissSelection,
        true
      );
    };
  }, [selectedCellKey]);

  function selectCell(cell: TimelineCell) {
    if (cell.amount <= 0) {
      return;
    }

    setSelectedCellKey((currentKey) =>
      currentKey === cell.key ? null : cell.key
    );
  }

  function changeType(nextType: TransactionType) {
    typeByPeriodRef.current.set(periodCacheKey, nextType);
    setType(nextType);
  }

  return (
    <section
      className="stats-chart-section stats-category-timeline"
      aria-labelledby="category-timeline-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="category-timeline-chart-title">Category Timeline</h2>
        <span className="stats-chart-section__period">
          {displayedPeriod}
        </span>
      </header>

      <SlidingSegmentedControl
        className="stats-category-timeline__type"
        value={type}
        options={categoryTypeOptions}
        onChange={changeType}
        label="Category type"
        tone={type === "INCOME" ? "income" : "expense"}
        compact
      />

      <div
        className="stats-category-timeline__interaction"
        ref={interactionRef}
      >
        {rows.length > 0 && intervals.length > 0 ? (
          <>
            <div
              className="stats-category-timeline__matrix"
              style={matrixStyle}
              role="grid"
              aria-label={`${type === "INCOME" ? "Income" : "Expense"} category intensity from ${displayedPeriod}.`}
            >
              <span aria-hidden="true" />
              {rows.map((row) => {
                const Icon = getCategoryIcon(row.category.id, type);

                return (
                  <span
                    key={row.category.id}
                    className="stats-category-timeline__category-icon"
                    role="columnheader"
                    aria-label={row.category.name}
                    title={row.category.name}
                  >
                    <Icon aria-hidden="true" />
                  </span>
                );
              })}

              {intervals.map((interval, intervalIndex) => (
                <Fragment key={interval.key}>
                  <span
                    className="stats-category-timeline__axis-label"
                    role="rowheader"
                    aria-label={interval.detailLabel}
                  >
                    {interval.axisLabel}
                  </span>
                  {rows.map((row) => {
                    const cell = row.cells[intervalIndex];

                    return cell ? (
                      <button
                        key={cell.key}
                        type="button"
                        className={[
                          "stats-category-timeline__cell",
                          `stats-category-timeline__cell--level-${cell.intensity}`,
                          selectedCellKey === cell.key
                            ? "is-selected"
                            : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectCell(cell)}
                        disabled={cell.amount <= 0}
                        role="gridcell"
                        aria-label={`${cell.category.name}, ${cell.interval.detailLabel}: ${formatEuroAmount(
                          cell.amount,
                          { fractionDigits: 0 }
                        )}, ${formatPercentage(cell.percentage)}`}
                      />
                    ) : (
                      <span
                        key={`${row.category.id}:${interval.key}:empty`}
                        aria-hidden="true"
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>

            <div
              className="stats-category-timeline__legend"
              aria-label="Intensity scale from less to more money"
            >
              <span>Less</span>
              {INTENSITY_LEVELS.map((level) => (
                <i
                  key={level}
                  className={`stats-category-timeline__legend-level stats-category-timeline__cell--level-${level}`}
                  aria-hidden="true"
                />
              ))}
              <span>More</span>
            </div>
          </>
        ) : (
          <p className="stats-category-timeline__empty">
            No {type === "INCOME" ? "income" : "expense"} data
          </p>
        )}

        <div
          className={`stats-category-timeline__detail${
            selectedCell ? " is-visible" : ""
          } stats-category-timeline__detail--${type.toLowerCase()}`}
          aria-live="polite"
          aria-hidden={selectedCell ? undefined : true}
        >
          {selectedCell ? (
            <>
              <span className="stats-category-timeline__detail-label">
                <strong>{selectedCell.category.name}</strong>
                <small>{selectedCell.interval.detailLabel}</small>
              </span>
              <span className="stats-category-timeline__detail-value">
                {formatPercentage(selectedCell.percentage)}
              </span>
              <span className="stats-category-timeline__detail-value">
                {formatEuroAmount(selectedCell.amount, {
                  fractionDigits: 0
                })}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
