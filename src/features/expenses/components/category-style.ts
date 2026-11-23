import type { IconName } from '@/components/ui';

// Warm, earthy hues that stay readable (≥3:1) as icons on the cream and dark surfaces.
const CATEGORY_STYLES: Record<string, { icon: IconName; color: string }> = {
  food: { icon: 'food', color: '#D9480F' },
  transport: { icon: 'transport', color: '#0B7285' },
  shopping: { icon: 'shopping', color: '#C2255C' },
  bills: { icon: 'bills', color: '#A16207' },
  entertainment: { icon: 'entertainment', color: '#2B8A3E' },
  other: { icon: 'category', color: '#7A6A58' },
};

/** Icon and colour for a category; custom categories share a rust tag style. */
export function categoryStyle(category: string): { icon: IconName; color: string } {
  return CATEGORY_STYLES[category] ?? { icon: 'tag', color: '#9A3412' };
}
