import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeEuro,
  BanknoteArrowUp,
  Bitcoin,
  Briefcase,
  Car,
  Dumbbell,
  Gift,
  Globe,
  GraduationCap,
  HandCoins,
  House,
  Landmark,
  PartyPopper,
  ShoppingBasket,
  ShoppingCart,
  Stethoscope,
  Utensils
} from "lucide-react";

export type TransactionType = "INCOME" | "EXPENSE";

export type TransactionCategoryDefinition = {
  id: string;
  name: string;
  type: TransactionType;
  icon: LucideIcon;
};

export const transactionCategories: readonly TransactionCategoryDefinition[] = [
  {
    id: "expense-dining",
    name: "Dining",
    type: "EXPENSE",
    icon: Utensils
  },
  {
    id: "expense-education",
    name: "Education",
    type: "EXPENSE",
    icon: GraduationCap
  },
  { id: "expense-gifts", name: "Gifts", type: "EXPENSE", icon: Gift },
  {
    id: "expense-groceries",
    name: "Groceries",
    type: "EXPENSE",
    icon: ShoppingBasket
  },
  { id: "expense-health", name: "Health", type: "EXPENSE", icon: Stethoscope },
  { id: "expense-housing", name: "Housing", type: "EXPENSE", icon: House },
  { id: "expense-parties", name: "Parties", type: "EXPENSE", icon: PartyPopper },
  {
    id: "expense-shopping",
    name: "Shopping",
    type: "EXPENSE",
    icon: ShoppingCart
  },
  { id: "expense-sports", name: "Sports", type: "EXPENSE", icon: Dumbbell },
  {
    id: "expense-subscriptions",
    name: "Subscriptions",
    type: "EXPENSE",
    icon: Globe
  },
  {
    id: "expense-transportation",
    name: "Transportation",
    type: "EXPENSE",
    icon: Car
  },
  {
    id: "expense-other",
    name: "Other",
    type: "EXPENSE",
    icon: ArrowDownRight
  },
  {
    id: "income-allowance",
    name: "Allowance",
    type: "INCOME",
    icon: HandCoins
  },
  {
    id: "income-benefits",
    name: "Benefits",
    type: "INCOME",
    icon: Landmark
  },
  {
    id: "income-freelance",
    name: "Freelance",
    type: "INCOME",
    icon: BanknoteArrowUp
  },
  { id: "income-gifts", name: "Gifts", type: "INCOME", icon: Gift },
  {
    id: "income-investments",
    name: "Investments",
    type: "INCOME",
    icon: Bitcoin
  },
  { id: "income-salary", name: "Salary", type: "INCOME", icon: Briefcase },
  { id: "income-sales", name: "Sales", type: "INCOME", icon: BadgeEuro },
  {
    id: "income-other",
    name: "Other",
    type: "INCOME",
    icon: ArrowUpRight
  }
];

export function getCategoryIcon(
  categoryId: string | undefined,
  type: TransactionType
) {
  return (
    transactionCategories.find((category) => category.id === categoryId)?.icon ??
    (type === "INCOME" ? ArrowUpRight : ArrowDownRight)
  );
}
