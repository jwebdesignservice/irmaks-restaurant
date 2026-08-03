// The one list of occasions. The UI renders it, the validator checks against
// it, and the database has a matching check constraint, so the three cannot
// drift apart.

export const OCCASIONS = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'business', label: 'Business meal' },
  { value: 'other', label: 'Something else' },
] as const

export type Occasion = (typeof OCCASIONS)[number]['value']

export function isOccasion(value: unknown): value is Occasion {
  return typeof value === 'string' && OCCASIONS.some((o) => o.value === value)
}

export function occasionLabel(value: string | null): string | null {
  return OCCASIONS.find((o) => o.value === value)?.label ?? null
}
