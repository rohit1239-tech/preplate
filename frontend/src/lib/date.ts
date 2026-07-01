function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIsoDate() {
  return localIsoDate(new Date());
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

export function slotCutoffAt(deliveryDate: string, cutoffTime: string) {
  const [year, month, day] = deliveryDate.split("-").map(Number);
  const [hours, minutes, seconds = "0"] = cutoffTime.split(":");
  return new Date(year, month - 1, day, Number(hours), Number(minutes), Number(seconds));
}

export function secondsUntilSlotCutoff(deliveryDate: string, cutoffTime: string, now = new Date()) {
  return Math.floor((slotCutoffAt(deliveryDate, cutoffTime).getTime() - now.getTime()) / 1000);
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
