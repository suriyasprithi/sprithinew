// Curated map of lucide icon name → component. Admin form picks from these
// keys; customer-app renders via this lookup. Add to both lists when adding
// a new option.
import {
  ShoppingBag, ShoppingCart, Ticket, Briefcase, Bike, Apple, Cpu, Pill,
  UtensilsCrossed, Sparkles, Award, BadgeCheck, ShieldCheck, Truck,
  Watch, Headphones, Speaker, Tv, Camera, Tablet, Smartphone,
  Wallet, RotateCcw, Lock, Headset, Gift, Heart, Tag, Percent, Flame,
  Store, Zap, Crown, Star, Gem, Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  ShoppingBag, ShoppingCart, Ticket, Briefcase, Bike, Apple, Cpu, Pill,
  UtensilsCrossed, Sparkles, Award, BadgeCheck, ShieldCheck, Truck,
  Watch, Headphones, Speaker, Tv, Camera, Tablet, Smartphone,
  Wallet, RotateCcw, Lock, Headset, Gift, Heart, Tag, Percent, Flame,
  Store, Zap, Crown, Star, Gem, Rocket,
};

export const LUCIDE_NAMES = Object.keys(LUCIDE_BY_NAME);

export function lucideOrFallback(name: string | null, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!name) return fallback;
  return LUCIDE_BY_NAME[name] ?? fallback;
}
