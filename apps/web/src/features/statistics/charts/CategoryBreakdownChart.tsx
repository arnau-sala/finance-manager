import { useEffect, useMemo, useRef, useState } from "react";
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
import type { StatisticsPeriodMode } from "../statistics-api";

type CategoryBreakdownChartProps = {
  mode: StatisticsPeriodMode;
  periodStart: string;
  periodEnd: string;
  categories: readonly (CategoryBreakdownItem & {
    type: TransactionType;
  })[];
};

type MatrixRectangle = {
  row: number;
  column: number;
  width: number;
  height: number;
};

type MatrixCategorySeed = CategoryBreakdownItem & {
  targetBlockCount: number;
  colorIndex: number;
};

type MatrixCategory = MatrixCategorySeed & {
  blockCount: number;
  rectangle: MatrixRectangle;
};

type MatrixCell = {
  category: MatrixCategory;
  index: number;
  row: number;
  column: number;
  borderTop: boolean;
  borderRight: boolean;
  borderBottom: boolean;
  borderLeft: boolean;
};

type RectangularLayoutItem = MatrixRectangle & {
  categoryIndex: number;
};

type RectangularLayout = {
  cost: number;
  items: RectangularLayoutItem[];
};

const MATRIX_COLUMNS = 20;
const MATRIX_ROWS = 5;
const MATRIX_SIZE = MATRIX_COLUMNS * MATRIX_ROWS;
const CATEGORY_COLOR_COUNT = 12;
const AREA_ERROR_WEIGHT = 1_000_000;
const AREA_ERROR_SECONDARY_WEIGHT = 100_000;
const NON_SQUARE_PENALTY = 10_000;
const COMPACTNESS_PENALTY_WEIGHT = 20;
const HORIZONTAL_STRIP_PENALTY = 500;

const periodDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
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

function createMatrixCategorySeeds(
  sourceCategories: readonly CategoryBreakdownItem[],
  type: TransactionType
) {
  const categories = getVisibleCategoryBreakdown(
    sourceCategories,
    type
  );
  const total = categories.reduce(
    (sum, category) => sum + category.amount,
    0
  );

  if (total <= 0) {
    return [];
  }

  const allocations = categories.map((category) => {
    const exactBlocks = (category.amount * MATRIX_SIZE) / total;

    return {
      category,
      blockCount: Math.floor(exactBlocks),
      remainder: exactBlocks % 1
    };
  });
  const remainingBlocks =
    MATRIX_SIZE -
    allocations.reduce(
      (sum, allocation) => sum + allocation.blockCount,
      0
    );
  const roundedUpIds = new Set(
    [...allocations]
      .sort(
        (first, second) =>
          second.remainder - first.remainder ||
          second.category.amount - first.category.amount
      )
      .slice(0, remainingBlocks)
      .map(({ category }) => category.id)
  );
  return allocations
    .map<MatrixCategorySeed>(({ category, blockCount }, index) => {
      const finalBlockCount =
        blockCount + (roundedUpIds.has(category.id) ? 1 : 0);

      return {
        ...category,
        percentage: finalBlockCount,
        targetBlockCount: finalBlockCount,
        colorIndex: index % CATEGORY_COLOR_COUNT
      };
    })
    .filter(({ targetBlockCount }) => targetBlockCount > 0);
}

function getRectangleCost(
  width: number,
  height: number,
  targetBlockCount: number
) {
  const blockDifference = Math.abs(
    width * height - targetBlockCount
  );
  const aspectRatio = Math.max(width / height, height / width);
  const squarePenalty =
    width === height ? 0 : NON_SQUARE_PENALTY;
  const compactnessPenalty =
    (aspectRatio - 1) ** 2 * COMPACTNESS_PENALTY_WEIGHT;
  const orientationPenalty =
    height === 1 && width > 1 ? HORIZONTAL_STRIP_PENALTY : 0;

  return (
    blockDifference ** 4 * AREA_ERROR_WEIGHT +
    blockDifference ** 2 * AREA_ERROR_SECONDARY_WEIGHT +
    squarePenalty +
    compactnessPenalty +
    orientationPenalty
  );
}

function findRectangularLayout(
  categories: readonly MatrixCategorySeed[]
) {
  const memo = new Map<string, RectangularLayout | null>();

  function solve(
    startIndex: number,
    endIndex: number,
    width: number,
    height: number
  ): RectangularLayout | null {
    const categoryCount = endIndex - startIndex;

    if (categoryCount <= 0 || width * height < categoryCount) {
      return null;
    }

    const memoKey = `${startIndex}:${endIndex}:${width}:${height}`;

    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null;
    }

    if (categoryCount === 1) {
      const category = categories[startIndex];
      const layout = category
        ? {
            cost: getRectangleCost(
              width,
              height,
              category.targetBlockCount
            ),
            items: [
              {
                categoryIndex: startIndex,
                row: 0,
                column: 0,
                width,
                height
              }
            ]
          }
        : null;

      memo.set(memoKey, layout);
      return layout;
    }

    let bestLayout: RectangularLayout | null = null;

    function considerLayout(
      firstLayout: RectangularLayout | null,
      secondLayout: RectangularLayout | null,
      secondOffset: Pick<MatrixRectangle, "row" | "column">
    ) {
      if (!firstLayout || !secondLayout) {
        return;
      }

      const candidate: RectangularLayout = {
        cost: firstLayout.cost + secondLayout.cost,
        items: [
          ...firstLayout.items,
          ...secondLayout.items.map((item) => ({
            ...item,
            row: item.row + secondOffset.row,
            column: item.column + secondOffset.column
          }))
        ]
      };

      if (!bestLayout || candidate.cost < bestLayout.cost) {
        bestLayout = candidate;
      }
    }

    for (
      let splitIndex = startIndex + 1;
      splitIndex < endIndex;
      splitIndex += 1
    ) {
      const firstCategoryCount = splitIndex - startIndex;
      const secondCategoryCount = endIndex - splitIndex;

      for (let cut = 1; cut < width; cut += 1) {
        if (
          cut * height < firstCategoryCount ||
          (width - cut) * height < secondCategoryCount
        ) {
          continue;
        }

        considerLayout(
          solve(startIndex, splitIndex, cut, height),
          solve(splitIndex, endIndex, width - cut, height),
          { row: 0, column: cut }
        );
      }

      for (let cut = 1; cut < height; cut += 1) {
        if (
          width * cut < firstCategoryCount ||
          width * (height - cut) < secondCategoryCount
        ) {
          continue;
        }

        considerLayout(
          solve(startIndex, splitIndex, width, cut),
          solve(splitIndex, endIndex, width, height - cut),
          { row: cut, column: 0 }
        );
      }
    }

    memo.set(memoKey, bestLayout);
    return bestLayout;
  }

  return solve(
    0,
    categories.length,
    MATRIX_COLUMNS,
    MATRIX_ROWS
  );
}

function createMatrixCategories(
  sourceCategories: readonly CategoryBreakdownItem[],
  type: TransactionType
) {
  const categorySeeds = createMatrixCategorySeeds(
    sourceCategories,
    type
  );
  const layout = findRectangularLayout(categorySeeds);

  if (!layout) {
    return [];
  }

  return layout.items.flatMap<MatrixCategory>((item) => {
    const category = categorySeeds[item.categoryIndex];

    if (!category) {
      return [];
    }

    const blockCount = item.width * item.height;

    return [
      {
        ...category,
        percentage: blockCount,
        blockCount,
        rectangle: {
          row: item.row,
          column: item.column,
          width: item.width,
          height: item.height
        }
      }
    ];
  });
}

function createMatrixCells(categories: readonly MatrixCategory[]) {
  const cells = categories.flatMap((category) => {
    const { row, column, width, height } = category.rectangle;

    return Array.from({ length: height }, (_, rowOffset) =>
      Array.from({ length: width }, (_, columnOffset) => {
        const cellRow = row + rowOffset;
        const cellColumn = column + columnOffset;

        return {
          category,
          index: cellRow * MATRIX_COLUMNS + cellColumn,
          row: cellRow,
          column: cellColumn
        };
      })
    ).flat();
  });
  const cellsByPosition = new Map(
    cells.map((cell) => [`${cell.row}:${cell.column}`, cell])
  );

  return cells.map<MatrixCell>((cell) => {
    const { row, column } = cell;
    const topCell =
      row > 0
        ? cellsByPosition.get(`${row - 1}:${column}`)
        : undefined;
    const rightCell =
      column < MATRIX_COLUMNS - 1
        ? cellsByPosition.get(`${row}:${column + 1}`)
        : undefined;
    const bottomCell =
      row < MATRIX_ROWS - 1
        ? cellsByPosition.get(`${row + 1}:${column}`)
        : undefined;
    const leftCell =
      column > 0
        ? cellsByPosition.get(`${row}:${column - 1}`)
        : undefined;

    return {
      ...cell,
      borderTop:
        row > 0 && topCell?.category.id !== cell.category.id,
      borderRight:
        column < MATRIX_COLUMNS - 1 &&
        rightCell?.category.id !== cell.category.id,
      borderBottom:
        row < MATRIX_ROWS - 1 &&
        bottomCell?.category.id !== cell.category.id,
      borderLeft:
        column > 0 && leftCell?.category.id !== cell.category.id
    };
  });
}

function getCellClassName(
  cell: MatrixCell,
  selectedCategoryId: string | null
) {
  return [
    "stats-category-matrix__cell",
    `stats-category-matrix__cell--tone-${cell.category.colorIndex + 1}`,
    cell.borderTop ? "has-top-border" : "",
    cell.borderRight ? "has-right-border" : "",
    cell.borderBottom ? "has-bottom-border" : "",
    cell.borderLeft ? "has-left-border" : "",
    cell.row === 0 && cell.column === 0
      ? "is-top-left-corner"
      : "",
    cell.row === 0 && cell.column === MATRIX_COLUMNS - 1
      ? "is-top-right-corner"
      : "",
    cell.row === MATRIX_ROWS - 1 && cell.column === 0
      ? "is-bottom-left-corner"
      : "",
    cell.row === MATRIX_ROWS - 1 &&
    cell.column === MATRIX_COLUMNS - 1
      ? "is-bottom-right-corner"
      : "",
    selectedCategoryId !== null &&
    selectedCategoryId !== cell.category.id
      ? "is-muted"
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getCategoryControlClassName(
  category: MatrixCategory,
  selectedCategoryId: string | null
) {
  return [
    "stats-category-matrix__category-control",
    `stats-category-matrix__cell--tone-${category.colorIndex + 1}`,
    selectedCategoryId !== null &&
    selectedCategoryId !== category.id
      ? "is-muted"
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export default function CategoryBreakdownChart({
  mode,
  periodStart,
  periodEnd,
  categories: sourceCategories
}: CategoryBreakdownChartProps) {
  const matrixRef = useRef<HTMLDivElement>(null);
  const typeByPeriodRef = useRef<Map<string, TransactionType>>(new Map());
  const previousModeRef = useRef<StatisticsPeriodMode>(mode);
  const periodCacheKey = `${mode}:${periodStart}:${periodEnd}`;
  const defaultType = useMemo(
    () => getDefaultCategoryType(sourceCategories),
    [sourceCategories]
  );
  const [type, setType] = useState<TransactionType>(defaultType);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | null
  >(null);
  const categoryTypeOptions = useMemo(
    () => createCategoryTypeOptions(sourceCategories),
    [sourceCategories]
  );
  const categories = useMemo(
    () =>
      createMatrixCategories(
        sourceCategories.filter((category) => category.type === type),
        type
      ),
    [sourceCategories, type]
  );
  const cells = useMemo(
    () => createMatrixCells(categories),
    [categories]
  );
  const selectedCategory =
    categories.find(({ id }) => id === selectedCategoryId) ?? null;
  const displayedPeriod = useMemo(
    () => formatDisplayedPeriod(periodStart, periodEnd),
    [periodEnd, periodStart]
  );

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
    setSelectedCategoryId(null);
  }, [mode, periodEnd, periodStart, type]);

  useEffect(() => {
    if (selectedCategoryId === null) {
      return;
    }

    const dismissSelection = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !matrixRef.current?.contains(target)
      ) {
        setSelectedCategoryId(null);
      }
    };

    document.addEventListener("pointerdown", dismissSelection, true);

    return () => {
      document.removeEventListener("pointerdown", dismissSelection, true);
    };
  }, [selectedCategoryId]);

  function selectCategory(categoryId: string) {
    setSelectedCategoryId((currentCategoryId) =>
      currentCategoryId === categoryId ? null : categoryId
    );
  }

  function changeType(nextType: TransactionType) {
    typeByPeriodRef.current.set(periodCacheKey, nextType);
    setType(nextType);
  }

  return (
    <section
      className="stats-chart-section stats-category-breakdown"
      aria-labelledby="category-breakdown-chart-title"
    >
      <header className="stats-chart-section__header">
        <h2 id="category-breakdown-chart-title">Category Breakdown</h2>
        <span className="stats-chart-section__period">{displayedPeriod}</span>
      </header>

      <SlidingSegmentedControl
        className="stats-category-breakdown__type"
        value={type}
        options={categoryTypeOptions}
        onChange={changeType}
        label="Category type"
        tone={type === "INCOME" ? "income" : "expense"}
        compact
      />

      <div className="stats-category-matrix__interaction" ref={matrixRef}>
        {cells.length === MATRIX_SIZE ? (
          <div
            className="stats-category-matrix"
            role="group"
            aria-label={`${type === "INCOME" ? "Income" : "Expense"} category breakdown from ${displayedPeriod}\nEach square represents one percent`}
          >
            {cells.map((cell) => (
              <span
                key={cell.index}
                className={getCellClassName(
                  cell,
                  selectedCategoryId
                )}
                style={{
                  gridColumn: cell.column + 1,
                  gridRow: cell.row + 1
                }}
                aria-hidden="true"
              />
            ))}

            {categories.map((category) => {
              const Icon = getCategoryIcon(category.id, type);
              const { row, column, width, height } =
                category.rectangle;

              return (
                <button
                  key={category.id}
                  type="button"
                  className={getCategoryControlClassName(
                    category,
                    selectedCategoryId
                  )}
                  style={{
                    gridColumn: `${column + 1} / span ${width}`,
                    gridRow: `${row + 1} / span ${height}`
                  }}
                  onClick={() => selectCategory(category.id)}
                  aria-label={`${category.name}: ${category.percentage}%`}
                >
                  <Icon aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="stats-category-matrix__empty">
            No {type === "INCOME" ? "income" : "expense"} data
          </p>
        )}

        <div
          className={`stats-category-matrix__detail${
            selectedCategory ? " is-visible" : ""
          } stats-category-matrix__detail--${type.toLowerCase()}`}
          aria-live="polite"
          aria-hidden={selectedCategory ? undefined : true}
        >
          {selectedCategory ? (
            <>
              <strong>{selectedCategory.name}</strong>
              <span className="stats-category-matrix__detail-value">
                {selectedCategory.percentage}%
              </span>
              <span className="stats-category-matrix__detail-value">
                {formatEuroAmount(selectedCategory.amount, {
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
