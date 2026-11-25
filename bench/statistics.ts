/** Median of the samples; with an even count, the mean of the two middle values. */
export function median(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new Error("median of no samples");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}
