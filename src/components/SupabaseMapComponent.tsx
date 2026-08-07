'use client';

import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { useMembers } from '../hooks/useMembers';
import { memberDuplicateKey } from '../lib/memberKey';
import { parseKmlPlacemarks } from '../lib/parseKml';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** Nominatim impose ~1 req/s : en dessous, la plupart des géocodages échouent. */
const GEOCODE_DELAY_MS = 1100;

type MemberPayload = {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  poste?: string;
  ville?: string;
  pays?: string;
};

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const SupabaseMapComponent: React.FC = () => {
  const { members, loading, error, addMember, updateMember, loadMembers } = useMembers();
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [newMember, setNewMember] = useState({ name: '', address: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const geocodeCache = useRef<Map<string, [number, number] | null>>(new Map());
  const geocodeProvider = useRef(new OpenStreetMapProvider());

  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    const query = address.trim();
    if (!query) return null;

    if (geocodeCache.current.has(query)) {
      return geocodeCache.current.get(query)!;
    }

    try {
      const results = await geocodeProvider.current.search({ query });
      const coordinates =
        results.length > 0 ? ([results[0].y, results[0].x] as [number, number]) : null;

      geocodeCache.current.set(query, coordinates);
      await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));

      return coordinates;
    } catch (err) {
      console.error('Erreur de géocodage:', err);
      await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));
      return null;
    }
  };

  const upsertMember = async (
    payload: MemberPayload,
    index: Map<string, string>
  ): Promise<'created' | 'updated'> => {
    const key = memberDuplicateKey(
      payload.name,
      payload.address,
      payload.latitude,
      payload.longitude
    );
    const existingId = index.get(key);
    const data = {
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      address: payload.address,
      description: payload.description,
      poste: payload.poste || '',
      ville: payload.ville || '',
      pays: payload.pays || '',
    };

    if (existingId) {
      await updateMember(existingId, data, { silent: true });
      return 'updated';
    }

    const result = await addMember(data, { silent: true });
    if (result.member?.id) {
      index.set(key, result.member.id);
    }
    return result.action;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isKML =
      file.name.toLowerCase().endsWith('.kml') ||
      file.type === 'application/vnd.google-earth.kml+xml';
    const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

    if (!isKML && !isCSV) {
      alert('Veuillez sélectionner un fichier KML ou CSV valide');
      return;
    }

    setIsLoadingFile(true);
    setLoadingProgress(0);
    setLoadingStatus('Lecture du fichier…');

    let added = 0;
    let updated = 0;
    let skipped = 0;

    const index = new Map<string, string>();
    for (const member of members) {
      index.set(
        memberDuplicateKey(member.name, member.address || '', member.latitude, member.longitude),
        member.id
      );
    }

    try {
      const fileText = await file.text();

      if (isCSV) {
        const lines = fileText.split('\n');
        const dataLines = lines.slice(1).filter((line) => line.trim());

        for (let i = 0; i < dataLines.length; i++) {
          const values = dataLines[i]
            .split(',')
            .map((value) => value.trim().replace(/^"(.*)"$/, '$1'));

          if (values.length >= 3) {
            const name = values[0] || 'Point sans nom';
            const lat = parseFloat(values[1]);
            const lng = parseFloat(values[2]);
            const address = values[3] || '';
            const description = values[4] || '';

            if (!isNaN(lat) && !isNaN(lng)) {
              const action = await upsertMember(
                { name, latitude: lat, longitude: lng, address, description },
                index
              );
              if (action === 'created') added++;
              else updated++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }

          setLoadingProgress(Math.round(((i + 1) / dataLines.length) * 100));
          setLoadingStatus(`CSV ${i + 1}/${dataLines.length}`);
        }
      } else if (isKML) {
        const placemarks = parseKmlPlacemarks(fileText);
        setLoadingStatus(`${placemarks.length} points à traiter…`);

        for (let i = 0; i < placemarks.length; i++) {
          const place = placemarks[i];
          setLoadingStatus(`Géocodage ${i + 1}/${placemarks.length} — ${place.name}`);

          let latitude = place.latitude;
          let longitude = place.longitude;

          if (latitude == null || longitude == null) {
            if (!place.geocodeQuery) {
              skipped++;
              setLoadingProgress(Math.round(((i + 1) / placemarks.length) * 100));
              continue;
            }
            const coordinates = await geocodeAddress(place.geocodeQuery);
            if (!coordinates) {
              skipped++;
              setLoadingProgress(Math.round(((i + 1) / placemarks.length) * 100));
              continue;
            }
            latitude = coordinates[0];
            longitude = coordinates[1];
          }

          const action = await upsertMember(
            {
              name: place.name,
              latitude,
              longitude,
              address: place.address || place.geocodeQuery,
              description: place.description,
              poste: place.poste,
              ville: place.ville,
              pays: place.pays,
            },
            index
          );
          if (action === 'created') added++;
          else updated++;

          setLoadingProgress(Math.round(((i + 1) / placemarks.length) * 100));
        }
      }

      await loadMembers({ silent: true });
      alert(
        `Fichier traité !\n` +
          `${added} ajouté(s)\n` +
          `${updated} mis à jour\n` +
          (skipped > 0 ? `${skipped} ignoré(s) (géocodage impossible)\n` : '') +
          `\nUn gros fichier KML peut prendre plusieurs minutes.`
      );
    } catch (err) {
      console.error('Erreur lors du chargement du fichier:', err);
      alert('Erreur lors du chargement du fichier');
    } finally {
      setIsLoadingFile(false);
      setLoadingProgress(0);
      setLoadingStatus('');
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const addNewMember = async () => {
    if (!newMember.name || !newMember.address) {
      alert("Veuillez remplir le nom et l'adresse");
      return;
    }

    setIsGeocoding(true);
    try {
      const coordinates = await geocodeAddress(newMember.address);
      if (coordinates) {
        const index = new Map<string, string>();
        for (const member of members) {
          index.set(
            memberDuplicateKey(
              member.name,
              member.address || '',
              member.latitude,
              member.longitude
            ),
            member.id
          );
        }

        const action = await upsertMember(
          {
            name: newMember.name,
            latitude: coordinates[0],
            longitude: coordinates[1],
            address: newMember.address,
            description: newMember.description,
          },
          index
        );

        setNewMember({ name: '', address: '', description: '' });
        setShowAddForm(false);
        await loadMembers({ silent: true });
        alert(
          action === 'updated'
            ? 'Membre déjà présent — informations mises à jour.'
            : 'Membre ajouté avec succès !'
        );
      } else {
        alert('Impossible de géocoder cette adresse');
      }
    } catch (err) {
      console.error("Erreur lors de l'ajout:", err);
      alert("Erreur lors de l'ajout du membre");
    } finally {
      setIsGeocoding(false);
    }
  };

  const centerMap = () => {
    if (members.length > 0) {
      const bounds = members.map((member) => [member.latitude, member.longitude] as [number, number]);
      const avgLat = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
      const avgLng = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
      setMapCenter([avgLat, avgLng]);
      setMapZoom(3);
    } else {
      setMapCenter([20, 0]);
      setMapZoom(2);
    }
  };

  const exportCsv = () => {
    if (members.length === 0) {
      alert('Aucun membre à exporter');
      return;
    }

    const header = 'name,latitude,longitude,address,description,poste,ville,pays';
    const rows = members.map((m) =>
      [m.name, m.latitude, m.longitude, m.address, m.description, m.poste, m.ville, m.pays]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `membres-fio-mfi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-fio-paper">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(31,111,122,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(196,122,44,0.12), transparent 50%), linear-gradient(180deg, #eef4f6 0%, #f7fafb 40%, #f3f6f8 100%)',
        }}
      />

      <header className="relative z-20 border-b border-fio-line/80 bg-fio-ink text-white shadow-panel">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="fio-fade-up min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                FIO-MFI · ICC Online
              </p>
              <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Carte des membres
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/70">
                Visualisez le réseau mondial et mettez à jour les points depuis un fichier KML ou
                CSV.
              </p>
            </div>

            <div className="fio-fade-up flex flex-wrap items-center gap-2" style={{ animationDelay: '80ms' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-input"
                disabled={isLoadingFile}
              />
              <label
                htmlFor="file-input"
                className={`${btnBase} cursor-pointer ${
                  isLoadingFile
                    ? 'bg-white/20 text-white/70'
                    : 'bg-fio-accent text-white hover:bg-[#b36c24]'
                }`}
              >
                {isLoadingFile ? `Import ${loadingProgress}%` : 'Importer KML / CSV'}
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowAddForm((v) => !v);
                  if (!showAddForm) setShowHelp(false);
                }}
                className={`${btnBase} bg-white/10 text-white hover:bg-white/15`}
              >
                Ajouter un membre
              </button>

              <button
                type="button"
                onClick={centerMap}
                className={`${btnBase} bg-white/10 text-white hover:bg-white/15`}
              >
                Recentrer
              </button>

              <button
                type="button"
                onClick={() => loadMembers()}
                disabled={loading || isLoadingFile}
                className={`${btnBase} bg-white/10 text-white hover:bg-white/15`}
              >
                {loading ? 'Chargement…' : 'Rafraîchir'}
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={members.length === 0}
                className={`${btnBase} bg-white/10 text-white hover:bg-white/15`}
              >
                Exporter CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowHelp((v) => !v);
                  if (!showHelp) setShowAddForm(false);
                }}
                className={`${btnBase} border border-white/25 bg-transparent text-white hover:bg-white/10`}
                aria-expanded={showHelp}
              >
                {showHelp ? 'Masquer l’aide' : 'Comment ça marche ?'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {showHelp && (
        <section className="relative z-10 border-b border-fio-line bg-white/90 backdrop-blur-sm">
          <div className="fio-fade-up px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="font-display text-lg font-semibold text-fio-ink">
                  Mode d’emploi — mise à jour de la carte
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-fio-ink/75">
                  Cette carte affiche les membres FIO-MFI enregistrés en base. Pour la synchroniser
                  avec Google My Maps : exportez le fichier <strong>KML</strong> depuis My Maps,
                  puis utilisez <strong>Importer KML / CSV</strong>. Les points déjà présents
                  (même nom + même adresse) sont mis à jour ; les nouveaux sont ajoutés. Un import
                  volumineux peut prendre plusieurs minutes (géocodage automatique des adresses).
                </p>
              </div>
              <ol className="grid w-full max-w-xl gap-2 text-sm sm:grid-cols-3">
                {[
                  {
                    n: '1',
                    t: 'Exporter',
                    d: 'Dans My Maps → menu → Exporter au format KML/KMZ.',
                  },
                  {
                    n: '2',
                    t: 'Importer',
                    d: 'Cliquez sur « Importer KML / CSV » et choisissez le fichier.',
                  },
                  {
                    n: '3',
                    t: 'Vérifier',
                    d: 'Attendez la fin de l’import, puis parcourez la carte.',
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className="rounded-xl border border-fio-line bg-fio-mist/60 px-3 py-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-fio-sea">
                      Étape {step.n}
                    </p>
                    <p className="mt-1 font-semibold text-fio-ink">{step.t}</p>
                    <p className="mt-1 text-fio-ink/65">{step.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {showAddForm && (
        <section className="relative z-10 border-b border-fio-line bg-white">
          <div className="px-4 py-4 sm:px-6">
            <h3 className="font-display text-base font-semibold text-fio-ink">
              Ajouter un membre manuellement
            </h3>
            <p className="mt-1 text-sm text-fio-ink/65">
              L’adresse sera convertie en coordonnées automatiquement.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder="Nom du membre / cellule"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="rounded-lg border border-fio-line bg-fio-paper px-3 py-2.5 text-sm outline-none ring-fio-sea focus:ring-2"
              />
              <input
                type="text"
                placeholder="Adresse (ville, pays…)"
                value={newMember.address}
                onChange={(e) => setNewMember({ ...newMember, address: e.target.value })}
                className="rounded-lg border border-fio-line bg-fio-paper px-3 py-2.5 text-sm outline-none ring-fio-sea focus:ring-2"
              />
              <input
                type="text"
                placeholder="Description (optionnel)"
                value={newMember.description}
                onChange={(e) => setNewMember({ ...newMember, description: e.target.value })}
                className="rounded-lg border border-fio-line bg-fio-paper px-3 py-2.5 text-sm outline-none ring-fio-sea focus:ring-2"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addNewMember}
                disabled={isGeocoding}
                className={`${btnBase} bg-fio-sea text-white hover:bg-fio-sea-deep`}
              >
                {isGeocoding ? 'Géocodage…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={`${btnBase} border border-fio-line bg-white text-fio-ink hover:bg-fio-mist`}
              >
                Annuler
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="relative z-10 border-b border-fio-line bg-white/80 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        {isLoadingFile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-fio-sea border-t-transparent" />
              <span className="text-sm font-medium text-fio-sea">
                Import en cours ({loadingProgress}%) — {loadingStatus}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fio-mist">
              <div
                className="h-full rounded-full bg-fio-sea transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-xs text-fio-ink/55">
              Ne fermez pas cet onglet. Le géocodage est limité à environ 1 adresse par seconde.
            </p>
          </div>
        ) : loading && members.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-fio-sea border-t-transparent" />
            <span className="fio-pulse-soft text-sm font-medium text-fio-sea">
              Chargement des membres…
            </span>
          </div>
        ) : error && members.length === 0 ? (
          <p className="text-sm font-medium text-red-700">Erreur : {error}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-fio-ink/80">
              <span className="font-bold text-fio-sea">{members.length}</span> membre
              {members.length !== 1 ? 's' : ''} sur la carte
            </p>
            <p className="text-xs text-fio-ink/45">
              Les doublons (même nom + adresse) sont mis à jour automatiquement à l’import.
            </p>
          </div>
        )}
      </div>

      <div className="relative z-0 min-h-0 flex-1 p-3 sm:p-4">
        <div className="h-full overflow-hidden rounded-2xl border border-fio-line bg-white shadow-panel">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
            worldCopyJump
            minZoom={2}
            maxZoom={18}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {members.map((member) => (
              <Marker key={member.id} position={[member.latitude, member.longitude]}>
                <Popup>
                  <div>
                    <h3>{member.name}</h3>
                    {member.poste && (
                      <p className="text-sm text-fio-sea">{member.poste}</p>
                    )}
                    {(member.ville || member.pays) && (
                      <p className="mt-1 text-sm text-gray-600">
                        {[member.ville, member.pays].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {member.address && (
                      <p className="mt-1 text-sm text-gray-600">{member.address}</p>
                    )}
                    {member.description && (
                      <p className="mt-2 text-sm text-gray-700">{member.description}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default SupabaseMapComponent;
