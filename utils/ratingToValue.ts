const ratingToValueMap: Record<string, number> = {
  INA: -1,
  SUS: 0,
  OBS: 1,
  S1: 2,
  S2: 3,
  S3: 4,
  C1: 5,
  C2: 6,
  C3: 7,
  I1: 8,
  I2: 9,
  I3: 10,
  SUP: 11,
  ADM: 12
};

const valueToRatingMap = Object.entries(ratingToValueMap).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {} as Record<number, string>);

export function getRatingValue(ratingString: string): number {
  return ratingToValueMap[ratingString] ?? 0;
}

export function getRatingFromValue(ratingValue: number): string {
  return valueToRatingMap[ratingValue] ?? "SUS";
}