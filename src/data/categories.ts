/**
 * Category catalog.
 *
 * Design-pass stand-in for the `categories` table (see §5 of the MVP plan),
 * which stores a lucide icon name and a `color_token` per row. Holding the icon
 * component and the token directly keeps the design pass free of a
 * name-to-component registry; when the table lands, this file becomes the seed.
 *
 * `tone` is an `AppColor`, so a category can never carry a raw color literal.
 */

import {
  Car,
  Ellipsis,
  HeartPulse,
  House,
  Lightbulb,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  User,
  type LucideIcon,
} from 'lucide-react-native';

import type { AppColor } from '@/theme';

export type CategoryId =
  | 'income'
  | 'shopping'
  | 'bills'
  | 'housing'
  | 'food'
  | 'transport'
  | 'health'
  | 'personal'
  | 'other';

export type Category = {
  label: string;
  icon: LucideIcon;
  /** Theme token the icon is painted with — mirrors `categories.color_token`. */
  tone: AppColor;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  income: { label: 'Income', icon: TrendingUp, tone: 'income' },
  shopping: { label: 'Shopping', icon: ShoppingBag, tone: 'foreground' },
  bills: { label: 'Bills', icon: Lightbulb, tone: 'warning' },
  housing: { label: 'Housing', icon: House, tone: 'iris' },
  food: { label: 'Food', icon: UtensilsCrossed, tone: 'accent' },
  transport: { label: 'Transport', icon: Car, tone: 'foreground' },
  health: { label: 'Health', icon: HeartPulse, tone: 'danger' },
  personal: { label: 'Personal', icon: User, tone: 'muted' },
  other: { label: 'Other', icon: Ellipsis, tone: 'muted' },
};
