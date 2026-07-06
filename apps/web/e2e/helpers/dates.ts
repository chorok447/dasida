/** LocalDate(yyyy-MM-dd). 오프셋은 일 단위. */
export function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const TINY_PNG = "e2e/fixtures/tiny.png";
