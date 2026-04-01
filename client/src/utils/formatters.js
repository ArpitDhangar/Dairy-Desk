const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

export function formatLiters(value) {
  return `${Number(value) || 0} L`;
}

export function formatDate(value) {
  if (!value) {
    return "--";
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return dateTimeFormatter.format(new Date(value));
}
