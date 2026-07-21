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

type FormatEuroOptions = {
  showSign?: boolean;
  fractionDigits?: 0 | 2;
};

export function formatEuroAmount(
  value: number | string,
  { showSign = false, fractionDigits = 2 }: FormatEuroOptions = {}
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "--";
  }

  const formatter =
    fractionDigits === 0
      ? showSign
        ? signedWholeEuroNumberFormatter
        : wholeEuroNumberFormatter
      : showSign
        ? signedEuroNumberFormatter
        : euroNumberFormatter;

  return `${formatter.format(amount)}\u20ac`;
}
