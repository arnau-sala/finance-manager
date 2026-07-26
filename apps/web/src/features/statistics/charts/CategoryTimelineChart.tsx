import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  SlidingSegmentedControl,
  type SlidingSegmentOption
} from "../../../components/ui/SlidingSegmentedControl";
import { formatEuroAmount } from "../../../money/format-euro";
import {
  getCategoryIcon,
  type TransactionType
} from "../../transactions/category-catalog";
import {
  getMockCategoryBreakdown,
  getVisibleCategoryBreakdown,
  type CategoryBreakdownItem,
  type StatisticsCategoryPeriodMode
} from "../statistics-category-mock";
import {
  getFinancialIntervals,
  type FinancialInterval
} from "./statistics-chart-periods";

type CategoryTimelineChartProps = {
  mode: StatisticsCategoryPeriodMode;
  selectedMonth: string;
  selectedYear: number;
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
const categoryTypeOptions: readonly SlidingSegmentOption<TransactionType>[] = [
  { value: "INCOME", label: "Income", icon: ArrowUpRight },
  { value: "EXPENSE", label: "Expenses", icon: ArrowDownRight }
];
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

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthEndDate(monthKey: string) {
  const todayKey = getLocalDateKey(new Date());

  if (monthKey === todayKey.slice(0, 7)) {
    return todayKey;
  }

  const [year = 0, month = 1] = monthKey.split("-").map(Number);
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${monthKey}-${String(finalDay).padStart(2, "0")}`;
}

function createMonthIntervals(selectedMonth: string): TimelineInterval[] {
  const finalDay = Number(getMonthEndDate(selectedMonth).slice(8, 10));
  const intervals: TimelineInterval[] = [];

  for (let startDay = 1; startDay <= finalDay; startDay += 7) {
    const endDay = Math.min(startDay + 6, finalDay);
    const startDate = `${selectedMonth}-${String(startDay).padStart(
      2,
      "0"
    )}`;
    const endDate = `${selectedMonth}-${String(endDay).padStart(2, "0")}`;

    intervals.push({
      key: `${selectedMonth}:week-${intervals.length + 1}`,
      axisLabel: `Week ${intervals.length + 1}`,
      detailLabel: `${startDay}-${endDay} ${monthFormatter.format(
        toUtcDate(startDate)
      )}`,
      startDate,
      endDate
    });
  }

  return intervals;
}

function mapFinancialInterval(
  interval: FinancialInterval
): TimelineInterval {
  return {
    key: interval.key,
    axisLabel: interval.axisLabel,
    detailLabel: interval.tooltipLabel,
    startDate: interval.startDate,
    endDate: interval.endDate
  };
}

function createTimelineIntervals(
  mode: StatisticsCategoryPeriodMode,
  selectedMonth: string,
  selectedYear: number
) {
  if (mode === "MONTH") {
    return createMonthIntervals(selectedMonth);
  }

  return getFinancialIntervals(mode, selectedYear).map(
    mapFinancialInterval
  );
}

function formatDisplayedPeriod(intervals: readonly TimelineInterval[]) {
  const firstInterval = intervals[0];
  const finalInterval = intervals[intervals.length - 1];

  if (!firstInterval || !finalInterval) {
    return "";
  }

  return `${periodDateFormatter.format(
    toUtcDate(firstInterval.startDate)
  )} - ${periodDateFormatter.format(toUtcDate(finalInterval.endDate))}`;
}

function getStringHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function distributeMonthAmounts(
  categories: readonly CategoryBreakdownItem[],
  intervals: readonly TimelineInterval[],
  selectedMonth: string
) {
  const amountsByInterval = new Map<
    string,
    ReadonlyMap<string, number>
  >(
    intervals.map((interval) => [
      interval.key,
      new Map<string, number>()
    ])
  );

  categories.forEach((category) => {
    const anchor =
      intervals.length > 0
        ? getStringHash(`${selectedMonth}:${category.id}`) %
          intervals.length
        : 0;
    const weights = intervals.map((_, intervalIndex) => {
      const distance = Math.abs(intervalIndex - anchor);
      const variation =
        (getStringHash(`${category.id}:${intervalIndex}`) % 3) + 1;

      return Math.max(1, 6 - distance * 2 + variation);
    });
    const totalWeight = weights.reduce(
      (total, weight) => total + weight,
      0
    );
    let allocatedAmount = 0;

    intervals.forEach((interval, intervalIndex) => {
      const amount =
        intervalIndex === intervals.length - 1
          ? category.amount - allocatedAmount
          : Math.round(
              ((category.amount * (weights[intervalIndex] ?? 0)) /
                totalWeight) *
                100
            ) / 100;
      allocatedAmount += amount;
      const intervalAmounts = amountsByInterval.get(interval.key);

      if (intervalAmounts instanceof Map) {
        intervalAmounts.set(category.id, Math.max(0, amount));
      }
    });
  });

  return amountsByInterval;
}

function groupIntervalAmounts(
  breakdown: readonly CategoryBreakdownItem[],
  visibleCategories: readonly CategoryBreakdownItem[],
  type: TransactionType
) {
  const otherId = `${type.toLowerCase()}-other`;
  const visibleCategoryIds = new Set(
    visibleCategories
      .filter((category) => category.id !== otherId)
      .map((category) => category.id)
  );
  const amountsByCategory = new Map(
    breakdown.map((category) => [category.id, category.amount])
  );

  if (visibleCategories.some((category) => category.id === otherId)) {
    const otherAmount = breakdown
      .filter(
        (category) =>
          category.id === otherId ||
          !visibleCategoryIds.has(category.id)
      )
      .reduce((total, category) => total + category.amount, 0);
    amountsByCategory.set(otherId, otherAmount);
  }

  return new Map(
    visibleCategories.map((category) => [
      category.id,
      amountsByCategory.get(category.id) ?? 0
    ])
  );
}

function createIntervalAmounts(
  mode: StatisticsCategoryPeriodMode,
  selectedMonth: string,
  selectedYear: number,
  type: TransactionType,
  intervals: readonly TimelineInterval[],
  categories: readonly CategoryBreakdownItem[]
) {
  if (mode === "MONTH") {
    return distributeMonthAmounts(categories, intervals, selectedMonth);
  }

  return new Map(
    intervals.map((interval) => {
      const intervalYear = Number(interval.key.slice(0, 4));
      const breakdown = getMockCategoryBreakdown({
        mode: mode === "YEAR" ? "MONTH" : "YEAR",
        selectedMonth:
          mode === "YEAR" ? interval.key : `${interval.key}-01`,
        selectedYear:
          mode === "YEAR" ? selectedYear : intervalYear,
        type
      });

      return [
        interval.key,
        groupIntervalAmounts(breakdown, categories, type)
      ];
    })
  );
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
  amountsByInterval: ReadonlyMap<
    string,
    ReadonlyMap<string, number>
  >
) {
  const maximumAmount = Math.max(
    0,
    ...intervals.flatMap((interval) => [
      ...categories.map(
        (category) =>
          amountsByInterval.get(interval.key)?.get(category.id) ?? 0
      )
    ])
  );

  return categories.map<TimelineRow>((category) => ({
    category,
    cells: intervals.map((interval) => {
      const intervalAmounts = amountsByInterval.get(interval.key);
      const amount = intervalAmounts?.get(category.id) ?? 0;
      const intervalTotal = [
        ...(intervalAmounts?.values() ?? [])
      ].reduce((total, intervalAmount) => total + intervalAmount, 0);

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
  selectedMonth,
  selectedYear
}: CategoryTimelineChartProps) {
  const interactionRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<TransactionType>("INCOME");
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(
    null
  );
  const intervals = useMemo(
    () => createTimelineIntervals(mode, selectedMonth, selectedYear),
    [mode, selectedMonth, selectedYear]
  );
  const categories = useMemo(
    () =>
      getVisibleCategoryBreakdown(
        getMockCategoryBreakdown({
          mode,
          selectedMonth,
          selectedYear,
          type
        }),
        type
      ),
    [mode, selectedMonth, selectedYear, type]
  );
  const amountsByInterval = useMemo(
    () =>
      createIntervalAmounts(
        mode,
        selectedMonth,
        selectedYear,
        type,
        intervals,
        categories
      ),
    [categories, intervals, mode, selectedMonth, selectedYear, type]
  );
  const rows = useMemo(
    () => createTimelineRows(categories, intervals, amountsByInterval),
    [amountsByInterval, categories, intervals]
  );
  const selectedCell =
    rows
      .flatMap((row) => row.cells)
      .find((cell) => cell.key === selectedCellKey) ?? null;
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(intervals),
    [intervals]
  );
  const matrixStyle = {
    "--timeline-columns": rows.length,
    "--timeline-cell-size": `${TIMELINE_CELL_SIZE}px`,
    "--timeline-label-width":
      mode === "MONTH" ? "42px" : mode === "YEAR" ? "26px" : "32px"
  } as CSSProperties;

  useEffect(() => {
    setSelectedCellKey(null);
  }, [mode, selectedMonth, selectedYear, type]);

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
        onChange={setType}
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
                          selectedCellKey !== null &&
                          selectedCellKey !== cell.key
                            ? "is-muted"
                            : "",
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
