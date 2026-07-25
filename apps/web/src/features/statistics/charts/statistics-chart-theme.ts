export type StatisticsChartTheme = {
  primary: string;
  primarySoft: string;
  success: string;
  danger: string;
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
    success: token("--color-success"),
    danger: token("--color-danger"),
    border: token("--color-border"),
    surface: token("--color-surface"),
    text: token("--color-text"),
    textMuted: token("--color-text-muted"),
    fontFamily: styles.fontFamily
  };
}
