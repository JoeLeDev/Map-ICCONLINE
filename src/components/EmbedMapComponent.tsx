'use client';

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useMembers } from '../hooks/useMembers';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const EmbedMapComponent: React.FC = () => {
  const { members, loading, error, realtimeStatus } = useMembers();
  const [mapCenter] = useState<[number, number]>([20, 0]); // Centre du monde avec légère inclinaison nord
  const [mapZoom] = useState(2); // Zoom pour voir le monde entier

  // Nombre total de membres dans toutes les FIO (Familles d'Impact Online).
  // Une FIO étant un groupe de personnes, on compte ici le total de personnes,
  // pas le nombre de groupes.
  const memberCount = members.length;

  // Ne bloquer l'UI que pour le tout premier chargement et seulement si on n'a
  // encore aucune donnée. Une déconnexion Realtime ultérieure ne masquera plus
  // la carte.
  const isInitialLoading = loading && members.length === 0;
  const hasBlockingError = error && members.length === 0;

  if (isInitialLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  if (hasBlockingError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-center">
          <p className="text-red-600">Erreur de chargement: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {realtimeStatus === 'disconnected' && (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full"
              title="La connexion temps réel s'est interrompue. Reconnexion automatique en cours."
            >
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Reconnexion en cours…
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 sm:px-6">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          worldCopyJump={true}
          maxBounds={[[-85, -180], [85, 180]]}
          minZoom={2}
          maxZoom={18}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {members.map((member) => (
            <Marker key={member.id} position={[member.latitude, member.longitude]}>
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg mb-3">{member.name}</h3>

                  {member.description && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">📝 Description:</p>
                      <p className="text-sm text-gray-600 ml-2">{member.description}</p>
                    </div>
                  )}

                  {member.address && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">📍 Adresse:</p>
                      <p className="text-sm text-gray-600 ml-2">{member.address}</p>
                    </div>
                  )}

                  {member.poste && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">💼 Poste:</p>
                      <p className="text-sm text-gray-600 ml-2">{member.poste}</p>
                    </div>
                  )}

                  {member.ville && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">🏙️ Ville:</p>
                      <p className="text-sm text-gray-600 ml-2">{member.ville}</p>
                    </div>
                  )}

                  {member.pays && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">🌍 Pays:</p>
                      <p className="text-sm text-gray-600 ml-2">{member.pays}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
          La famille ICC Online rassemble aujourd'hui{' '}
          <span className="font-semibold text-gray-900">
            {memberCount.toLocaleString('fr-FR')}
          </span>{' '}
          {memberCount > 1 ? 'membres répartis' : 'membre'} dans le monde au sein
          de nos FIO (Familles d'Impact Online). Chaque point sur la carte
          représente un membre connecté à notre communauté.
        </p>
      </div>
    </div>
  );
};

export default EmbedMapComponent;