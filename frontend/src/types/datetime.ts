/**
 * Represents a point in time with seconds and nanoseconds precision
 */
export interface DateTime {
  /** The number of seconds since the Unix epoch (1970-01-01T00:00:00Z) */
  seconds: number;

  /** The number of nanoseconds (0-999,999,999) since the seconds value */
  nanoseconds: number;
}

/**
 * Converts a JavaScript Date object to a DateTime
 */
export function dateToDateTime(date: Date): DateTime {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
  };
}

/**
 * Converts a DateTime to a JavaScript Date object
 */
export function dateTimeToDate(dateTime: DateTime): Date {
  return new Date(
    dateTime.seconds * 1000 + Math.floor(dateTime.nanoseconds / 1_000_000),
  );
}
