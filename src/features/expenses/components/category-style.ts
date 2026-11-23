import type { IconName } from '@/components/ui';

const CATEGORY_STYLES: Record<string, { icon: IconName; color: string }> = {
  food: { icon: 'food', color: '#E04F16' },
  transport: { icon: 'transport', color: '#1570EF' },
  shopping: { icon: 'shopping', color: '#DD2590' },
  bills: { icon: 'bills', color: '#CA8504' },
  entertainment: { icon: 'entertainment', color: '#7A5AF8' },
  other: { icon: 'category', color: '#667085' },
};

/** Icon and colour for a category; custom categories share a neutral tag style. */
export function categoryStyle(category: string): { icon: IconName; color: string } {
  return CATEGORY_STYLES[category] ?? { icon: 'tag', color: '#0E9384' };
}

/** Adds alpha to a #RRGGBB colour for soft icon backgrounds. */
export function tint(color: string, alpha = 0.14): string {
  const value = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${value}`;
}
