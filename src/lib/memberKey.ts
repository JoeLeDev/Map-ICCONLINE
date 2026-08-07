/** Normalise une chaîne pour comparer les doublons (casse / espaces). */
export function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Clé de déduplication : nom + adresse, ou nom + coordonnées si pas d'adresse.
 */
export function memberDuplicateKey(
  name: string,
  address = '',
  latitude?: number,
  longitude?: number
): string {
  const n = normalizeKeyPart(name);
  const a = normalizeKeyPart(address);
  if (a) return `${n}|addr:${a}`;
  if (
    latitude != null &&
    longitude != null &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  ) {
    return `${n}|geo:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  }
  return `${n}|`;
}
