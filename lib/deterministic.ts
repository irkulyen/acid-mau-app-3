export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed: number, step = 0): number {
  let value = (seed ^ Math.imul(step + 1, 2654435761)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 3266489917) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

export function seededRange(seed: number, min: number, max: number, step = 0): number {
  const unit = seededUnit(seed, step);
  return min + unit * (max - min);
}

export function pickBySeed<T>(items: readonly T[], seed: number, step = 0): T {
  if (items.length === 0) {
    throw new Error("pickBySeed called with empty array");
  }
  const idx = Math.min(items.length - 1, Math.floor(seededUnit(seed, step) * items.length));
  return items[idx];
}
