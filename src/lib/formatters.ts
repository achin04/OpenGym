export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}

export function formatPrice(price: { toString: () => string } | null) {
  if (price === null) {
    return "Free";
  }

  const amount = Number(price.toString());

  if (amount === 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}