export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatShellCommandBinary(binaryPath: string | null | undefined): string {
  const trimmed = binaryPath?.trim();
  return trimmed && trimmed.length > 0 ? shellQuote(trimmed) : "opencode";
}
