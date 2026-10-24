// Use Date to normalize the calendar date.
export function calendarDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
