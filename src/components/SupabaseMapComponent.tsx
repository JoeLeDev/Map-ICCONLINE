'use client';

import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { useMembers } from '../hooks/useMembers';
import { memberDuplicateKey } from '../lib/memberKey';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const SupabaseMapComponent: React.FC = () => {
  const { members, loading, error, addMember, updateMember, loadMembers } = useMembers();
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.2276, 2.2137]);
  const [mapZoom, setMapZoom] = useState(6);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', address: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Cache pour éviter de géocoder plusieurs fois la même adresse
  const geocodeCache = useRef<Map<string, [number, number] | null>>(new Map());

  // Fonction pour géocoder une adresse
  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    if (geocodeCache.current.has(address)) {
      return geocodeCache.current.get(address)!;
    }

    try {
      const provider = new OpenStreetMapProvider();
      const results = await provider.search({ query: address });
      const coordinates = results.length > 0 ? [results[0].y, results[0].x] as [number, number] : null;
      
      geocodeCache.current.set(address, coordinates);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return coordinates;
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      geocodeCache.current.set(address, null);
      return null;
    }
  };

  /** Ajoute ou met à jour selon la clé nom+adresse (ou nom+coords). */
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

  // Fonction pour gérer l'upload de fichier
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isKML = file.name.toLowerCase().endsWith('.kml') || file.type === 'application/vnd.google-earth.kml+xml';
    const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

    if (!isKML && !isCSV) {
      alert('Veuillez sélectionner un fichier KML ou CSV valide');
      return;
    }

    setIsLoadingFile(true);
    setLoadingProgress(0);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    // Index local pour détecter les doublons pendant tout l'import
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
          const values = dataLines[i].split(',').map((value) =>
            value.trim().replace(/^"(.*)"$/, '$1')
          );

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
        }
      } else if (isKML) {
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(fileText, 'text/xml');
        const placemarks = kmlDoc.querySelectorAll('Placemark');

        for (let i = 0; i < placemarks.length; i++) {
          const placemark = placemarks[i];
          const nameElement = placemark.querySelector('name');
          const addressElement = placemark.querySelector('address');
          const descriptionElement = placemark.querySelector('description');

          const name = nameElement?.textContent || 'Point sans nom';
          const address = addressElement?.textContent?.trim() || '';
          const description = descriptionElement?.textContent?.replace(/<br>/g, '\n') || '';

          if (address) {
            const coordinates = await geocodeAddress(address);
            if (coordinates) {
              const action = await upsertMember(
                {
                  name,
                  latitude: coordinates[0],
                  longitude: coordinates[1],
                  address,
                  description,
                },
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

          setLoadingProgress(Math.round(((i + 1) / placemarks.length) * 100));
        }
      }

      await loadMembers({ silent: true });
      alert(
        `Fichier traité !\n` +
          `✅ ${added} ajouté(s)\n` +
          `🔄 ${updated} mis à jour\n` +
          (skipped > 0 ? `⏭️ ${skipped} ignoré(s)\n` : '')
      );
      
    } catch (error) {
      console.error('Erreur lors du chargement du fichier:', error);
      alert('Erreur lors du chargement du fichier');
    } finally {
      setIsLoadingFile(false);
      setLoadingProgress(0);
      // Réinitialiser l'input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Fonction pour ajouter un nouveau membre
  const addNewMember = async () => {
    if (!newMember.name || !newMember.address) {
      alert('Veuillez remplir le nom et l\'adresse');
      return;
    }

    setIsGeocoding(true);
    try {
      const coordinates = await geocodeAddress(newMember.address);
      if (coordinates) {
        const index = new Map<string, string>();
        for (const member of members) {
          index.set(
            memberDuplicateKey(member.name, member.address || '', member.latitude, member.longitude),
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
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      alert('Erreur lors de l\'ajout du membre');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Fonction pour centrer la carte
  const centerMap = () => {
    if (members.length > 0) {
      const bounds = members.map(member => [member.latitude, member.longitude]);
      const avgLat = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
      const avgLng = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
      setMapCenter([avgLat, avgLng]);
      setMapZoom(10);
    } else {
      setMapCenter([46.2276, 2.2137]);
      setMapZoom(6);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header moderne */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🗺️</span>
              <div>
                <h1 className="text-2xl font-bold">Carte des Membres FIO-MFI</h1>
                <p className="text-blue-100 text-sm">Base de données Supabase</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              >
                📁 Charger Fichier
              </label>
              
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ➕ Ajouter Membre
              </button>
              
              <button
                onClick={centerMap}
                className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🎯 Centrer
              </button>
              
              <button
                onClick={() => loadMembers()}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>{loading ? 'Chargement...' : 'Rafraîchir'}</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 Effacer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout moderne */}
      {showAddForm && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-orange-200 shadow-lg">
          <div className="px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Ajouter un nouveau membre</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Nom du membre"
                value={newMember.name}
                onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Adresse complète"
                value={newMember.address}
                onChange={(e) => setNewMember({...newMember, address: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Description (optionnel)"
                value={newMember.description}
                onChange={(e) => setNewMember({...newMember, description: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={addNewMember}
                disabled={isGeocoding}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 px-6 py-2 rounded-lg text-white font-medium transition-colors"
              >
                {isGeocoding ? '⏳ Géocodage...' : '✅ Ajouter le membre'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded-lg text-white font-medium transition-colors"
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone de statut moderne */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          {loading ? (
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-600 font-medium">Chargement des membres...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-3">
              <span className="text-red-600">❌</span>
              <span className="text-red-600 font-medium">Erreur: {error}</span>
            </div>
          ) : members.length > 0 ? (
            <div className="flex items-center space-x-3">
              <span className="text-green-600">✅</span>
              <span className="text-green-600 font-bold">{members.length}</span>
              <span className="text-gray-600">membre(s) chargé(s) depuis Supabase</span>
            </div>
          ) : (
            <span className="text-gray-600">Aucun membre dans la base de données</span>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="flex-1">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {members.map((member) => (
            <Marker key={member.id} position={[member.latitude, member.longitude]}>
              <Popup>
                <div>
                  <h3 className="font-bold">{member.name}</h3>
                  {member.address && (
                    <p className="text-sm text-gray-600 mt-1">{member.address}</p>
                  )}
                  {member.description && (
                    <p className="text-sm mt-2">{member.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default SupabaseMapComponent;
