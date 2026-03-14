export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatLargeNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat().format(value);
}

export function formatTotalDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0 min";
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${mins} min`;
  }

  return `${hours} hr ${mins} min`;
}

export function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

export function formatRelativeDate(timestamp) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return "-";
  }

  const diffMs = time - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absDiffMs < minute) {
    return rtf.format(Math.round(diffMs / 1000), "second");
  }
  if (absDiffMs < hour) {
    return rtf.format(Math.round(diffMs / minute), "minute");
  }
  if (absDiffMs < day) {
    return rtf.format(Math.round(diffMs / hour), "hour");
  }
  if (absDiffMs < week) {
    return rtf.format(Math.round(diffMs / day), "day");
  }
  if (absDiffMs < month) {
    return rtf.format(Math.round(diffMs / week), "week");
  }
  if (absDiffMs < year) {
    return rtf.format(Math.round(diffMs / month), "month");
  }

  return rtf.format(Math.round(diffMs / year), "year");
}
