'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { useMembers } from '../hooks/useMembers';

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
  address?: string;
}

const MapComponent: React.FC = () => {
  const [kmlData, setKmlData] = useState<KMLData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.2276, 2.2137]); // Centre de la France
  const [mapZoom, setMapZoom] = useState(6);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', address: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache pour éviter de géocoder plusieurs fois la même adresse
  const geocodeCache = useRef<Map<string, [number, number] | null>>(new Map());

  // Fonction pour géocoder une adresse
  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    // Vérifier le cache d'abord
    if (geocodeCache.current.has(address)) {
      return geocodeCache.current.get(address)!;
    }

    try {
      const provider = new OpenStreetMapProvider();
      const results = await provider.search({ query: address });
      const coordinates = results.length > 0 ? [results[0].y, results[0].x] as [number, number] : null;
      
      // Mettre en cache le résultat
      geocodeCache.current.set(address, coordinates);
      
      // Petite pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return coordinates;
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      geocodeCache.current.set(address, null);
      return null;
    }
  };

  // Fonction pour parser le fichier KML
  const parseKML = async (kmlText: string): Promise<KMLData[]> => {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.querySelectorAll('Placemark');
    const data: KMLData[] = [];
    const total = placemarks.length;

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const nameElement = placemark.querySelector('name');
      const descriptionElement = placemark.querySelector('description');
      const coordinatesElement = placemark.querySelector('coordinates');
      const addressElement = placemark.querySelector('address');
      
      let coordinates: [number, number] | null = null;
      
      // Essayer d'abord les coordonnées directes
      if (coordinatesElement) {
        const coords = coordinatesElement.textContent?.trim();
        if (coords) {
          const [lng, lat] = coords.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            coordinates = [lat, lng];
          }
        }
      }
      
      // Si pas de coordonnées directes, géocoder l'adresse
      if (!coordinates && addressElement) {
        const address = addressElement.textContent?.trim();
        if (address) {
          coordinates = await geocodeAddress(address);
        }
      }
      
      if (coordinates) {
        // Nettoyer la description HTML
        let cleanDescription = descriptionElement?.textContent || '';
        if (cleanDescription.includes('<br>')) {
          cleanDescription = cleanDescription.replace(/<br>/g, '\n');
        }
        
        data.push({
          name: nameElement?.textContent || 'Point sans nom',
          coordinates: coordinates,
          description: cleanDescription
        });
      }
      
      // Mettre à jour la progression avec plus de détails
      const progress = Math.round(((i + 1) / total) * 100);
      setLoadingProgress(progress);
      
      // Afficher un message de progression dans la console pour le debug
      if ((i + 1) % 10 === 0 || i === total - 1) {
        console.log(`Géocodage: ${i + 1}/${total} (${progress}%)`);
      }
    }

    return data;
  };

  // Fonction pour parser un fichier CSV
  const parseCSV = (csvText: string): KMLData[] => {
    const lines = csvText.split('\n');
    const data: KMLData[] = [];
    
    // Ignorer la première ligne (headers)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parser CSV simple (gère les guillemets)
      const values = line.split(',').map(value => 
        value.trim().replace(/^"(.*)"$/, '$1')
      );
      
      // Format avec coordonnées: name,latitude,longitude,address,description,poste,ville,pays
      if (values.length >= 8) {
        const name = values[0] || 'Point sans nom';
        const lat = parseFloat(values[1]);
        const lng = parseFloat(values[2]);
        const address = values[3] || '';
        const description = values[4] || '';
        const poste = values[5] || '';
        const ville = values[6] || '';
        const pays = values[7] || '';
        
        if (!isNaN(lat) && !isNaN(lng)) {
          data.push({
            name: name,
            coordinates: [lat, lng],
            description: `${description} | ${poste} | ${ville} | ${pays}`
          });
        }
      }
      // Format sans coordonnées: nom,description,adresse,Poste,Ville,Pays
      else if (values.length >= 6) {
        const name = values[0] || 'Point sans nom';
        const address = values[2] || '';
        const description = values[1] || '';
        const poste = values[3] || '';
        const ville = values[4] || '';
        const pays = values[5] || '';
        
        // Géocoder l'adresse si pas de coordonnées directes
        if (address) {
          data.push({
            name: name,
            coordinates: [0, 0], // Coordonnées temporaires - sera géocodé
            description: `${description} | ${poste} | ${ville} | ${pays}`,
            address: address // Marquer pour géocodage
          });
        }
      }
    }
    
    return data;
  };

  // Fonction pour charger un fichier (KML ou CSV)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const isKML = file.type === 'application/vnd.google-earth.kml+xml' ||
                  file.type === 'application/xml' ||
                  file.type === 'text/xml' ||
                  file.name.toLowerCase().endsWith('.kml');
                  
    const isCSV = file.type === 'text/csv' ||
                  file.name.toLowerCase().endsWith('.csv');
    
    if (isKML || isCSV) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileText = e.target?.result as string;
          let parsedData: KMLData[] = [];
          
          if (isCSV) {
            // Parser CSV - INSTANTANÉ !
            parsedData = parseCSV(fileText);
            console.log(`📊 CSV chargé: ${parsedData.length} points`);
          } else {
            // Parser KML avec géocodage
            if (!fileText.includes('<kml') && !fileText.includes('<KML')) {
              alert('Ce fichier ne semble pas être un fichier KML valide');
              setIsLoading(false);
              return;
            }
            parsedData = await parseKML(fileText);
          }
          setKmlData(parsedData);
          
          // Centrer la carte sur les données si il y en a
          if (parsedData.length > 0) {
            const bounds = parsedData.map(item => item.coordinates);
            const avgLat = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
            const avgLng = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
            setMapCenter([avgLat, avgLng]);
            setMapZoom(10);
          }
        } catch (error) {
          console.error('Erreur lors du parsing du KML:', error);
          alert('Erreur lors du chargement du fichier KML');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } else {
      alert('Veuillez sélectionner un fichier KML valide');
    }
  };

  // Fonction pour effacer les données
  const clearData = () => {
    setKmlData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fonction pour centrer la carte
  const centerMap = () => {
    if (kmlData.length > 0) {
      const bounds = kmlData.map(item => item.coordinates);
      const avgLat = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
      const avgLng = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
      setMapCenter([avgLat, avgLng]);
      setMapZoom(10);
    } else {
      setMapCenter([46.2276, 2.2137]);
      setMapZoom(6);
    }
  };

  // Fonction pour ajouter un nouveau membre
  const addNewMember = async () => {
    if (!newMember.name || !newMember.address) {
      alert('Veuillez remplir le nom et l\'adresse');
      return;
    }

    setIsLoading(true);
    try {
      const coordinates = await geocodeAddress(newMember.address);
      if (coordinates) {
        const newMemberData: KMLData = {
          name: newMember.name,
          coordinates: coordinates,
          description: newMember.description
        };
        
        setKmlData(prev => [...prev, newMemberData]);
        setNewMember({ name: '', address: '', description: '' });
        setShowAddForm(false);
        alert('Membre ajouté avec succès !');
      } else {
        alert('Impossible de géocoder cette adresse');
      }
    } catch (error) {
      alert('Erreur lors de l\'ajout du membre');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header moderne */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <span className="text-2xl">🗺️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Carte des Membres FIO-MFI</h1>
                <p className="text-blue-100 text-sm">Visualisation interactive des membres</p>
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
                className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <span>📁</span>
                <span>Charger Fichier</span>
              </label>
              
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <span>➕</span>
                <span>Ajouter</span>
              </button>
              
              <button
                onClick={centerMap}
                className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <span>🎯</span>
                <span>Centrer</span>
              </button>
              
              <button
                onClick={clearData}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <span>🗑️</span>
                <span>Effacer</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout moderne */}
      {showAddForm && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-orange-200 shadow-lg">
          <div className="px-6 py-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-500 p-2 rounded-lg">
                <span className="text-white text-lg">➕</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Ajouter un nouveau membre</h3>
                <p className="text-gray-600 text-sm">Remplissez les informations du nouveau membre</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Nom du membre</label>
                <input
                  type="text"
                  placeholder="Ex: ICCEL_ADORATEURS"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Adresse</label>
                <input
                  type="text"
                  placeholder="Ex: Paris France"
                  value={newMember.address}
                  onChange={(e) => setNewMember({...newMember, address: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Description (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Poste: Membre | Ville: Paris"
                  value={newMember.description}
                  onChange={(e) => setNewMember({...newMember, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={addNewMember}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Géocodage...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>Ajouter le membre</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 hover:bg-gray-600 px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <span>❌</span>
                <span>Annuler</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone de statut moderne */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          {isLoading ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-600 font-medium">Géocodage en cours...</span>
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <span className="text-blue-600 font-bold">{loadingProgress}%</span>
            </div>
          ) : kmlData.length > 0 ? (
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <span className="text-green-600 text-lg">✅</span>
              </div>
              <div>
                <span className="text-green-600 font-bold">{kmlData.length}</span>
                <span className="text-gray-600 ml-1">membre(s) chargé(s)</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <span className="text-gray-500 text-lg">📁</span>
              </div>
              <span className="text-gray-600">Aucun fichier chargé - Cliquez sur "Charger Fichier" pour commencer</span>
            </div>
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
          
          {/* Marqueurs des données KML */}
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
    </div>
  );
};

export default MapComponent;
