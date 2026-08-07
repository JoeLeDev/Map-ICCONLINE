export type KmlPlacemark = {
  name: string;
  address: string;
  description: string;
  poste: string;
  ville: string;
  pays: string;
  /** Requête optimale pour le géocodage (ville + pays si dispo). */
  geocodeQuery: string;
  latitude?: number;
  longitude?: number;
};

function localName(el: Element): string {
  return el.localName || el.nodeName.replace(/^.*:/, '');
}

function findChild(parent: Element, tag: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (localName(child).toLowerCase() === tag.toLowerCase()) return child;
  }
  return null;
}

function findChildren(parent: Element | Document, tag: string): Element[] {
  const root = parent instanceof Document ? parent.documentElement : parent;
  if (!root) return [];
  return Array.from(root.getElementsByTagName('*')).filter(
    (el) => localName(el).toLowerCase() === tag.toLowerCase()
  );
}

function textOf(el: Element | null): string {
  return el?.textContent?.trim() || '';
}

function parseExtendedData(placemark: Element): Record<string, string> {
  const data: Record<string, string> = {};
  const extended = findChild(placemark, 'ExtendedData');
  if (!extended) return data;

  for (const node of Array.from(extended.children)) {
    if (localName(node).toLowerCase() !== 'data') continue;
    const key = node.getAttribute('name') || '';
    const valueEl = findChild(node, 'value');
    if (key) data[key] = textOf(valueEl);
  }
  return data;
}

function parsePointCoordinates(placemark: Element): { latitude: number; longitude: number } | null {
  const point = findChild(placemark, 'Point');
  const coordsEl = point ? findChild(point, 'coordinates') : findChild(placemark, 'coordinates');
  const raw = textOf(coordsEl);
  if (!raw) return null;

  const [lngStr, latStr] = raw.split(',');
  const longitude = parseFloat(lngStr);
  const latitude = parseFloat(latStr);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Parse un KML My Maps / Google (namespaces, ExtendedData, CDATA).
 */
export function parseKmlPlacemarks(kmlText: string): KmlPlacemark[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Fichier KML invalide');
  }

  const placemarkEls = findChildren(doc, 'Placemark');
  const results: KmlPlacemark[] = [];

  for (const placemark of placemarkEls) {
    const name = textOf(findChild(placemark, 'name')) || 'Point sans nom';
    const address = textOf(findChild(placemark, 'address'));
    const description = textOf(findChild(placemark, 'description')).replace(/<br\s*\/?>/gi, '\n');
    const extended = parseExtendedData(placemark);

    const ville = extended.Ville || extended.ville || '';
    const pays = extended.Pays || extended.pays || '';
    const poste = extended.Poste || extended.poste || '';

    const geocodeQuery = [ville, pays].filter(Boolean).join(', ') || address;
    const point = parsePointCoordinates(placemark);

    results.push({
      name,
      address: address || geocodeQuery,
      description,
      poste,
      ville,
      pays,
      geocodeQuery,
      latitude: point?.latitude,
      longitude: point?.longitude,
    });
  }

  return results;
}
