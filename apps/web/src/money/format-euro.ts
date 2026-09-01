const euroNumberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false
});

const signedEuroNumberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
  useGrouping: false
});

const wholeEuroNumberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: false
});

const signedWholeEuroNumberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "always",
  useGrouping: false
});

const subtleMoneyGroupSeparator = "\u202f";

export type MoneyCurrencyCode = "EUR" | "USD";

type FormatMoneyOptions = {
  showSign?: boolean;
  fractionDigits?: 0 | 2;
  currency?: MoneyCurrencyCode;
};

function addSubtleMoneyGrouping(formattedNumber: string) {
  const [integerPart = "", decimalPart] = formattedNumber.split(",");
  const sign =
    integerPart.startsWith("+") || integerPart.startsWith("-")
      ? integerPart[0]
      : "";
  const unsignedInteger = sign ? integerPart.slice(1) : integerPart;
  const groupedInteger = unsignedInteger.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    subtleMoneyGroupSeparator
  );

  return `${sign}${groupedInteger}${
    decimalPart === undefined ? "" : `,${decimalPart}`
  }`;
}

export function formatEuroInputAmount(value: string) {
  const normalizedValue = value.trim().replace(".", ",");

  return `${addSubtleMoneyGrouping(normalizedValue)}\u20ac`;
}

function getCurrencySymbol(currency: MoneyCurrencyCode) {
  return currency === "EUR" ? "\u20ac" : "$";
}

export function formatMoneyAmount(
  value: number | string,
  {
    showSign = false,
    fractionDigits = 2,
    currency = "EUR"
  }: FormatMoneyOptions = {}
) {
  const normalizedValue =
    typeof value === "string" ? value.trim() : value;
  const amount = normalizedValue === "" ? Number.NaN : Number(normalizedValue);

  if (!Number.isFinite(amount)) {
    return "Amount unavailable";
  }

  const formatter =
    fractionDigits === 0
      ? showSign
        ? signedWholeEuroNumberFormatter
        : wholeEuroNumberFormatter
      : showSign
        ? signedEuroNumberFormatter
        : euroNumberFormatter;

  return `${addSubtleMoneyGrouping(formatter.format(amount))}${getCurrencySymbol(
    currency
  )}`;
}

export function formatEuroAmount(
  value: number | string,
  options: Omit<FormatMoneyOptions, "currency"> = {}
) {
  return formatMoneyAmount(value, { ...options, currency: "EUR" });
}
