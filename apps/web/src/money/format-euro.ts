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

type FormatEuroOptions = {
  showSign?: boolean;
};

export function formatEuroAmount(
  value: number | string,
  { showSign = false }: FormatEuroOptions = {}
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "--";
  }

  const formatter = showSign
    ? signedEuroNumberFormatter
    : euroNumberFormatter;

  return `${formatter.format(amount)}\u20ac`;
}
