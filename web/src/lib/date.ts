import { formatDistanceToNow } from "date-fns";

export const getLocalDateTimeInputValue = (date: Date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  const local = new Date(parsed.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

export const parseLocalDateTimeInput = (value: string) => {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return null;
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (
    [year, month, day, hour, minute].some(
      (segment) => segment === undefined || Number.isNaN(segment)
    )
  ) {
    return null;
  }

  const result = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(result.getTime()) ? null : result;
};

export const formatWithTimezone = (date: Date | string | null | undefined) => {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    label: formatter.format(parsed),
    relative: formatDistanceToNow(parsed, { addSuffix: true }),
    timeZone,
    iso: parsed.toISOString(),
  };
};
