import { useMemo, type CSSProperties, type RefObject } from "react";

import { useAnchoredPicker } from "./useAnchoredPicker";

type YearPickerProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  value: number;
  availableYears: readonly number[];
  minimumYear: number | null;
  maximumYear: number;
  onSelect: (year: number) => void;
  onClose: () => void;
};

function createBalancedRows(years: readonly number[]) {
  if (years.length === 0) {
    return [];
  }

  const rowCount = Math.ceil(years.length / 3);
  const minimumItemsPerRow = Math.floor(years.length / rowCount);
  const widerRowCount = years.length % rowCount;
  const rows: number[][] = [];
  let startIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSize =
      minimumItemsPerRow + (rowIndex < widerRowCount ? 1 : 0);
    rows.push(years.slice(startIndex, startIndex + rowSize));
    startIndex += rowSize;
  }

  return rows;
}

export function YearPicker({
  open,
  anchorRef,
  value,
  availableYears,
  minimumYear,
  maximumYear,
  onSelect,
  onClose
}: YearPickerProps) {
  const years = useMemo(
    () =>
      minimumYear === null
        ? []
        : Array.from(
            { length: maximumYear - minimumYear + 1 },
            (_, index) => minimumYear + index
          ),
    [maximumYear, minimumYear]
  );
  const rows = useMemo(() => createBalancedRows(years), [years]);
  const availableYearSet = useMemo(
    () => new Set(availableYears),
    [availableYears]
  );
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const {
    dialogRef,
    isClosing,
    position,
    requestClose,
    handleBackdropPointerDown
  } = useAnchoredPicker({
    open,
    anchorRef,
    onClose,
    positionKey: `${years.length}-${columnCount}`
  });

  if (!open || availableYears.length <= 1 || rows.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <div
      className="year-picker-backdrop"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={dialogRef}
        className={`year-picker year-picker--${columnCount}-columns${
          position ? " is-positioned" : ""
        }${isClosing ? " is-closing" : ""}`}
        style={
          position
            ? ({
                top: position.top,
                left: position.left,
                "--picker-origin-x": `${position.originX}px`
              } as CSSProperties)
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label="Choose year"
        tabIndex={-1}
      >
        <div className="year-picker__content">
          {rows.map((row) => (
            <div
              className={`year-picker__row year-picker__row--${row.length}`}
              key={row[0]}
            >
              {row.map((year) => {
                const disabled = !availableYearSet.has(year);
                const selected = year === value;
                const current = year === currentYear;
                const className = [
                  selected ? "is-selected" : "",
                  current ? "is-current" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={year}
                    type="button"
                    disabled={disabled}
                    className={className || undefined}
                    aria-pressed={selected}
                    aria-current={current ? "date" : undefined}
                    onClick={() => {
                      onSelect(year);
                      requestClose();
                    }}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
