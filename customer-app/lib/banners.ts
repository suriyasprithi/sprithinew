// Shape returned by GET /api/v1/public/banners (grouped by slot).
// Mirrors backend/app/Models/HomeBannerModel.php

export type BannerSlot =
  | "coupon"
  | "hero_left"
  | "hero_center"
  | "hero_right_top"
  | "hero_right_bottom"
  | "mega_left"
  | "mega_right";

export type Banner = {
  id: number;
  slot: BannerSlot;
  sort_order: number;
  eyebrow: string | null;
  title: string | null;
  highlight: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  gradient_from: string | null;
  gradient_mid: string | null;
  gradient_to: string | null;
  icon_name: string | null;
  status: "active" | "inactive";
};

export type BannersBySlot = Record<BannerSlot, Banner[]>;

export const EMPTY_BANNERS: BannersBySlot = {
  coupon: [],
  hero_left: [],
  hero_center: [],
  hero_right_top: [],
  hero_right_bottom: [],
  mega_left: [],
  mega_right: [],
};

/** Build a CSS gradient from from/mid/to hex strings. */
export function bannerGradient(b: Pick<Banner, "gradient_from" | "gradient_mid" | "gradient_to">): string {
  const stops = [b.gradient_from, b.gradient_mid, b.gradient_to].filter(Boolean) as string[];
  if (stops.length === 0) return "linear-gradient(135deg,#ff7a18,#c91d1d)";
  if (stops.length === 1) return `linear-gradient(135deg,${stops[0]},${stops[0]})`;
  return `linear-gradient(135deg,${stops.join(",")})`;
}
