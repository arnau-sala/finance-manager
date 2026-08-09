import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CalendarDatePicker } from "../src/components/ui/CalendarDatePicker";
import { MonthPicker } from "../src/components/ui/MonthPicker";
import { YearPicker } from "../src/components/ui/YearPicker";
import { formatFilterDateValue } from "../src/features/transactions/moves-filter-summary";

const meta = {
  title: "Design System/Pickers",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function CalendarPickerExample() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("2026-08-09");

  return (
    <section className="storybook-section">
      <h2>Date picker</h2>
      <button
        ref={anchorRef}
        className={`text-field-shell transaction-composer__date-control${
          open ? " is-picker-open" : ""
        }`}
        type="button"
        onClick={() => setOpen(true)}
      >
        {formatFilterDateValue(date)}
      </button>
      <CalendarDatePicker
        open={open}
        anchorRef={anchorRef}
        value={date}
        initialDate={date}
        minimumDate="2026-01-01"
        maximumDate="2026-08-09"
        onSelect={(nextDate) => {
          setDate(nextDate);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}

function MonthPickerExample() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("2026-07");

  return (
    <section className="storybook-section">
      <h2>Month picker</h2>
      <button
        ref={anchorRef}
        className="stats-period-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        July 2026
      </button>
      <MonthPicker
        open={open}
        anchorRef={anchorRef}
        value={month}
        availableMonths={[
          "2024-03",
          "2024-04",
          "2024-05",
          "2025-01",
          "2025-02",
          "2025-07",
          "2026-01",
          "2026-04",
          "2026-07",
          "2026-08"
        ]}
        minimumMonth="2024-03"
        maximumMonth="2026-08"
        onSelect={setMonth}
        onClose={() => setOpen(false)}
      />
      <small>Selected: {month}</small>
    </section>
  );
}

function YearPickerExample() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(2026);

  return (
    <section className="storybook-section">
      <h2>Year picker</h2>
      <button
        ref={anchorRef}
        className="stats-period-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        {year}
      </button>
      <YearPicker
        open={open}
        anchorRef={anchorRef}
        value={year}
        availableYears={[2024, 2025, 2026]}
        minimumYear={2024}
        maximumYear={2026}
        onSelect={setYear}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}

export const Components: Story = {
  render: () => (
    <main className="storybook-mobile-frame">
      <div className="storybook-stack">
        <CalendarPickerExample />
        <MonthPickerExample />
        <YearPickerExample />
      </div>
    </main>
  )
};
