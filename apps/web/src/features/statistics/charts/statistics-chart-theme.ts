export type StatisticsChartTheme = {
  primary: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  balance: string;
  balanceSoft: string;
  border: string;
  surface: string;
  text: string;
  textMuted: string;
  fontFamily: string;
};

export function getStatisticsChartTheme(): StatisticsChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();

  return {
    primary: token("--color-primary"),
    primarySoft: token("--color-primary-soft"),
    danger: token("--color-danger"),
    dangerSoft: token("--color-danger-soft"),
    balance: token("--color-category-3"),
    balanceSoft: token("--color-category-3-soft"),
    border: token("--color-border"),
    surface: token("--color-surface"),
    text: token("--color-text"),
    textMuted: token("--color-text-muted"),
    fontFamily: styles.fontFamily
  };
}
