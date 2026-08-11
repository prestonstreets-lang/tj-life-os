import { parseLocalDate, toLocalDateKey } from './date.js';

export function addCalendarDays(value, amount) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + Number(amount || 0));
  return toLocalDateKey(date);
}

export function startOfCalendarWeek(value, weekStartsOn = 0) {
  const date = parseLocalDate(value);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return toLocalDateKey(date);
}

export function calendarWeek(value, weekStartsOn = 0) {
  const start = startOfCalendarWeek(value, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
}

export function calendarMonthGrid(value, weekStartsOn = 0) {
  const anchor = parseLocalDate(value);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfCalendarWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}

export function shiftCalendar(value, mode, direction) {
  const date = parseLocalDate(value);
  const amount = direction < 0 ? -1 : 1;
  if (mode === 'month') date.setMonth(date.getMonth() + amount, 1);
  else if (mode === 'week') date.setDate(date.getDate() + amount * 7);
  else date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function sameCalendarMonth(left, right) {
  const a = parseLocalDate(left);
  const b = parseLocalDate(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function dateTimeFromLocalInputs(dateKey, time = '09:00') {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0).toISOString();
}
