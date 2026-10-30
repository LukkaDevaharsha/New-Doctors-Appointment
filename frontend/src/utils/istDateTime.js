export const APP_TIME_ZONE = 'Asia/Kolkata';

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid appointment date');
  return date;
}

export function getIstDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(asDate(value));
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function dateAtLocalNoon(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new RangeError('Expected a calendar date');
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatIstDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(asDate(value));
}

export function formatIstTime(value, options = {}) {
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  }).format(asDate(value))} IST`;
}

export function formatIstDateTime(value) {
  return `${formatIstDate(value)} at ${formatIstTime(value)}`;
}

export function istLocalDateTimeToUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new RangeError('Expected a local date and time');
  }
  const date = new Date(`${value}:00+05:30`);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid local date and time');
  return date.toISOString();
}

export function utcToIstLocalDateTime(value) {
  const date = asDate(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).slice(0, 5).split(':').map(Number);
  if (hours === 24 && minutes === 0) return 1440;
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function splitWeeklyWindows(windows, offsetMinutes) {
  const split = windows.flatMap((window) => {
    let start = timeToMinutes(window.startTime) + offsetMinutes;
    let end = timeToMinutes(window.endTime) + offsetMinutes;
    let day = Number(window.weekday);
    while (start < 0) { start += 1440; end += 1440; day -= 1; }
    while (start >= 1440) { start -= 1440; end -= 1440; day += 1; }
    const result = [];
    while (start < end) {
      const boundary = Math.min(end, 1440);
      result.push({
        weekday: ((day % 7) + 7) % 7,
        startTime: minutesToTime(start),
        endTime: boundary === 1440 ? '24:00' : minutesToTime(boundary),
        slotMinutes: Number(window.slotMinutes) || 30,
      });
      if (end <= 1440) break;
      end -= 1440;
      start = 0;
      day += 1;
    }
    return result;
  }).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  return split.reduce((merged, window) => {
    const previous = merged[merged.length - 1];
    if (previous && previous.weekday === window.weekday && previous.endTime === window.startTime && previous.slotMinutes === window.slotMinutes) previous.endTime = window.endTime;
    else merged.push({ ...window });
    return merged;
  }, []);
}

export function utcWindowsToIst(windows) {
  return splitWeeklyWindows(windows, 330);
}

export function istWindowsToUtc(windows) {
  return splitWeeklyWindows(windows, -330);
}
