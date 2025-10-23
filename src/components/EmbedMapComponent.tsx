'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface KMLData {
  name: string;
  coordinates: [number, number];
  description?: string;
}

const EmbedMapComponent: React.FC = () => {
  const [kmlData, setKmlData] = useState<KMLData[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.2276, 2.2137]);
  const [mapZoom, setMapZoom] = useState(6);

  // Charger les données depuis le fichier CSV par défaut
  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        // Essayer de charger le fichier CSV par défaut
        const response = await fetch('/membres-fio-mfi.csv');
        if (response.ok) {
          const csvText = await response.text();
          const lines = csvText.split('\n');
          const data: KMLData[] = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',').map(value => 
              value.trim().replace(/^"(.*)"$/, '$1')
            );
            
            if (values.length >= 8) {
              const name = values[0] || 'Point sans nom';
              const lat = parseFloat(values[1]);
              const lng = parseFloat(values[2]);
              const description = values[4] || '';
              
              if (!isNaN(lat) && !isNaN(lng)) {
                data.push({
                  name: name,
                  coordinates: [lat, lng],
                  description: description
                });
              }
            }
          }
          
          setKmlData(data);
          
          // Centrer la carte sur les données
          if (data.length > 0) {
            const bounds = data.map(item => item.coordinates);
            const avgLat = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
            const avgLng = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
            setMapCenter([avgLat, avgLng]);
            setMapZoom(10);
          }
        }
      } catch (error) {
        console.log('Aucun fichier CSV par défaut trouvé');
      }
    };

    loadDefaultData();
  }, []);

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
        
        {kmlData.map((point, index) => (
          <Marker key={index} position={point.coordinates}>
            <Popup>
              <div>
                <h3 className="font-bold">{point.name}</h3>
                {point.description && (
                  <p className="mt-2 text-sm">{point.description}</p>
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
