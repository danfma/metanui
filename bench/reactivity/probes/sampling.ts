// Shared timing for the probes: warm-up rounds are part of the samples, the minimum and median are printed.
export interface Sampled {
  readonly min: number;
  readonly median: number;
}

export function sampleMs(rounds: number, body: () => void): Sampled {
  const samples: number[] = [];

  for (let round = 0; round < rounds; round++) {
    globalThis.gc?.();

    const start = performance.now();

    body();
    samples.push(performance.now() - start);
  }

  samples.sort((left, right) => left - right);

  return { min: samples[0], median: samples[Math.floor(samples.length / 2)] };
}

export function formatSampled(label: string, sampled: Sampled): string {
  return `${label}: min ${sampled.min.toFixed(2)} ms, median ${sampled.median.toFixed(2)} ms`;
}
