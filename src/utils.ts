export function formatBytes(n: number): string {
  /**
   * Examples:
   * formatBytes(1)      // '1 B'
   * formatBytes(1234)   // '1.21 kiB'
   * formatBytes(12345678) // '11.77 MiB'
   * formatBytes(1234567890) // '1.15 GiB'
   * formatBytes(1234567890000) // '1.12 TiB'
   * formatBytes(1234567890000000) // '1.10 PiB'
   *
   * For all values < 2^60, the output is always <= 10 characters.
   * Note:Code adapted from dask.utils.format_bytes
   */
  const units: [string, number][] = [
    ['Pi', Math.pow(2, 50)],
    ['Ti', Math.pow(2, 40)],
    ['Gi', Math.pow(2, 30)],
    ['Mi', Math.pow(2, 20)],
    ['ki', Math.pow(2, 10)]
  ];

  for (const [prefix, k] of units) {
    if (n >= k * 0.9) {
      return `${(n / k).toFixed(2)} ${prefix}B`;
    }
  }
  return `${n} B`;
}
