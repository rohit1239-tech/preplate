export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

export function formatTime(value: string) {
  const [hours, minutes] = value.split(":");
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2026, 0, 1, Number(hours), Number(minutes)),
  );
}
