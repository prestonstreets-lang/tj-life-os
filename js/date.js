const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string') {
    const match = value.match(DATE_ONLY);
    if (match) {
      const [, year, month, day] = match;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day)) return parsed;
      return new Date(Number.NaN);
    }
  }
  return new Date(value);
}

export function toLocalDateKey(value = new Date()) {
  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDateOnly(value, fallback = new Date()) {
  return toLocalDateKey(value) || toLocalDateKey(fallback);
}

export function formatDayLabel(value, locale) {
  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(parsed);
}

export function compareDateOnly(left, right) {
  return normalizeDateOnly(left).localeCompare(normalizeDateOnly(right));
}
