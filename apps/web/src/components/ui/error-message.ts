export function formatErrorMessage(message: string) {
  return message.trimEnd().replace(/[.]+$/u, "");
}
