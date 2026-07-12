import type { ElementType } from "react";
import { CircleUserRound, House, ReceiptText, TrendingUp } from "lucide-react";

export type HomeSectionId = "home" | "moves" | "stats" | "profile";

export type HomeNavItem = {
  id: HomeSectionId;
  label: string;
  icon: ElementType<{ className?: string }>;
};

export const homeNavItems: HomeNavItem[] = [
  { id: "home", label: "home", icon: House },
  { id: "moves", label: "moves", icon: ReceiptText },
  { id: "stats", label: "stats", icon: TrendingUp },
  { id: "profile", label: "profile", icon: CircleUserRound }
];
