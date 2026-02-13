export function formatJod(amount: number) {
  try {
    return new Intl.NumberFormat("en-JO", {
      style: "currency",
      currency: "JOD",
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} JOD`;
  }
}
