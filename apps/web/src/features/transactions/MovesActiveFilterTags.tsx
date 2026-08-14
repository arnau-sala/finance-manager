import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleEuro,
  Shapes
} from "lucide-react";

import {
  transactionCategories,
  type TransactionCategoryDefinition
} from "./category-catalog";
import {
  getActiveCategoryIds,
  type MovesFilters
} from "./moves-filters";
import {
  getAmountFilterSummary,
  getDateFilterSummary
} from "./moves-filter-summary";

type MovesActiveFilterTagsProps = {
  filters: MovesFilters;
  onFilterSelect: (
    filter: "type" | "amount" | "date" | "categories"
  ) => void;
};

function isCategory(
  category: TransactionCategoryDefinition | undefined
): category is TransactionCategoryDefinition {
  return category !== undefined;
}

export function MovesActiveFilterTags({
  filters,
  onFilterSelect
}: MovesActiveFilterTagsProps) {
  const TypeIcon =
    filters.type === "EXPENSE" ? ArrowDownRight : ArrowUpRight;
  const amountSummary = getAmountFilterSummary(filters);
  const dateSummary = getDateFilterSummary(filters);
  const selectedCategories = getActiveCategoryIds(filters)
    .map((categoryId) =>
      transactionCategories.find((category) => category.id === categoryId)
    )
    .filter(isCategory)
    .sort((left, right) => {
      if (left.type === right.type) {
        return 0;
      }

      return left.type === "EXPENSE" ? -1 : 1;
    });

  return (
    <section className="moves-active-filters" aria-label="Active filters">
      <div className="moves-active-filters__tags">
        {filters.type !== "ALL" ? (
          <button
            type="button"
            className={`moves-active-filter-tag moves-active-filter-tag--type moves-active-filter-tag--${filters.type.toLowerCase()}`}
            aria-label={filters.type === "EXPENSE" ? "Expenses" : "Incomes"}
            title={filters.type === "EXPENSE" ? "Expenses" : "Incomes"}
            onClick={() => onFilterSelect("type")}
          >
            <TypeIcon aria-hidden="true" />
          </button>
        ) : null}

        {amountSummary ? (
          <button
            className="moves-active-filter-tag"
            type="button"
            aria-label={`Edit amount filter: ${amountSummary}`}
            onClick={() => onFilterSelect("amount")}
          >
            <CircleEuro aria-hidden="true" />
            <span className="moves-active-filter-tag__label">
              {amountSummary}
            </span>
          </button>
        ) : null}

        {dateSummary ? (
          <button
            className="moves-active-filter-tag"
            type="button"
            aria-label={`Edit date filter: ${dateSummary}`}
            onClick={() => onFilterSelect("date")}
          >
            <CalendarDays aria-hidden="true" />
            <span className="moves-active-filter-tag__label">
              {dateSummary}
            </span>
          </button>
        ) : null}

        {selectedCategories.length > 0 ? (
          <button
            className="moves-active-filter-tag moves-active-filter-tag--categories"
            type="button"
            aria-label={`Categories: ${selectedCategories
              .map((category) => category.name)
              .join(", ")}`}
            onClick={() => onFilterSelect("categories")}
          >
            <Shapes
              className="moves-active-filter-tag__category-title"
              aria-hidden="true"
            />
            <span
              className="moves-active-filter-tag__separator"
              aria-hidden="true"
            />
            <span className="moves-active-filter-tag__category-icons">
              {selectedCategories.map((category) => {
                const Icon = category.icon;

                return (
                  <span
                    key={category.id}
                    className={`moves-active-filter-tag__category-icon moves-active-filter-tag__category-icon--${category.type.toLowerCase()}`}
                    title={category.name}
                  >
                    <Icon aria-hidden="true" />
                  </span>
                );
              })}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
