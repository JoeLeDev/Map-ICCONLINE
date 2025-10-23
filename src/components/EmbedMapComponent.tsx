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
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.2276, 2.2137]);
  const [mapZoom, setMapZoom] = useState(6);

  // Centrer la carte sur les membres
  useEffect(() => {
    if (members.length > 0) {
      const latitudes = members.map(m => m.latitude);
      const longitudes = members.map(m => m.longitude);

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      setMapCenter([centerLat, centerLng]);

      // Calculer un zoom approprié
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;

      let newZoom = 6;
      if (members.length === 1) {
        newZoom = 12;
      } else if (latDiff > 0.01 || lngDiff > 0.01) {
        const zoomLat = Math.round(Math.log(360 / latDiff) / Math.LN2);
        const zoomLng = Math.round(Math.log(360 / lngDiff) / Math.LN2);
        newZoom = Math.min(zoomLat, zoomLng, 12);
      }
      setMapZoom(newZoom);
    }
  }, [members]);

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
                {member.description && (
                  <p className="mt-2 text-sm">{member.description}</p>
                )}
                {member.address && (
                  <p className="mt-1 text-xs text-gray-600">📍 {member.address}</p>
                )}
                {member.poste && (
                  <p className="mt-1 text-xs text-blue-600">💼 {member.poste}</p>
                )}
                {member.ville && member.pays && (
                  <p className="mt-1 text-xs text-green-600">🏙️ {member.ville}, {member.pays}</p>
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