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
  const { members, loading, error } = useMembers();
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]); // Centre du monde avec légère inclinaison nord
  const [mapZoom, setMapZoom] = useState(2); // Zoom pour voir le monde entier

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-center">
          <p className="text-red-600">Erreur de chargement: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
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
  );
};

export default EmbedMapComponent;