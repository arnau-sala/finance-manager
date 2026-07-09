export function centsToDecimal(amountCents: number) {
  const sign = amountCents < 0 ? "-" : "";
  const absoluteCents = Math.abs(amountCents);
  const wholePart = Math.floor(absoluteCents / 100);
  const decimalPart = (absoluteCents % 100).toString().padStart(2, "0");

  return `${sign}${wholePart}.${decimalPart}`;
}
