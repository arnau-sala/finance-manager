import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TransactionCategoryPicker } from "../src/features/transactions/TransactionCategoryPicker";
import { TransactionDateField } from "../src/features/transactions/TransactionDateField";
import { TransactionRow } from "../src/features/transactions/TransactionRow";
import {
  TransactionTypeSwitch,
  type TransactionTypeSelection
} from "../src/features/transactions/TransactionTypeSwitch";
import { FirstTransactionEmptyState } from "../src/features/transactions/FirstTransactionEmptyState";

const meta = {
  title: "Transactions/Components",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function TransactionControls() {
  const [type, setType] = useState<TransactionTypeSelection>("EXPENSE");
  const [categoryId, setCategoryId] = useState("expense-groceries");
  const [date, setDate] = useState("2026-08-09");

  const transactionType = type === "INCOME" ? "INCOME" : "EXPENSE";

  return (
    <div className={`transaction-composer transaction-composer--${transactionType.toLowerCase()} is-open`}>
      <div className="transaction-composer__content">
        <TransactionTypeSwitch value={type} onChange={setType} />

        <div className="transaction-composer__field">
          <div className="transaction-composer__field-heading">
            <span className="text-field-label">Name</span>
            <span className="transaction-composer__character-count">42/50</span>
          </div>
          <textarea
            className="text-field text-field--composer text-field--multiline"
            rows={1}
            defaultValue="Weekly groceries"
          />
        </div>

        <TransactionCategoryPicker
          type={transactionType}
          selectedCategoryIds={[categoryId]}
          onCategorySelect={setCategoryId}
        />

        <TransactionDateField
          id="storybook-transaction-date"
          label="Date"
          value={date}
          minimumDate="2026-01-01"
          maximumDate="2026-08-09"
          selected
          onChange={setDate}
        />
      </div>
    </div>
  );
}

export const RowsAndEmptyStates: Story = {
  render: () => (
    <main className="storybook-mobile-frame">
      <div className="storybook-stack">
        <section className="storybook-section">
          <h2>Transaction rows</h2>
          <ul className="storybook-list home-move-list">
            <TransactionRow
              type="EXPENSE"
              categoryId="expense-groceries"
              categoryName="Groceries"
              amount="42.5"
              description="Supermarket"
              date="2026-08-09"
            />
            <TransactionRow
              type="INCOME"
              categoryId="income-salary"
              categoryName="Salary"
              amount="2200"
              description="Monthly salary"
              date="2026-08-01"
            />
            <TransactionRow
              type="EXPENSE"
              categoryId="expense-subscriptions"
              categoryName="Subscriptions"
              amount="11.99"
              description="Music app"
              date="2026-07-28"
            />
          </ul>
        </section>

        <section className="storybook-section">
          <h2>Latest moves empty state</h2>
          <div style={{ height: 230 }}>
            <FirstTransactionEmptyState
              headingId="storybook-empty-transactions"
              description="Add your first transaction to start building your history."
              onNewTransaction={() => undefined}
            />
          </div>
        </section>
      </div>
    </main>
  )
};

export const ComposerControls: Story = {
  render: () => (
    <main className="storybook-mobile-frame">
      <TransactionControls />
    </main>
  )
};
