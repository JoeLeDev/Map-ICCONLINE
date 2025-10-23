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

const SupabaseMapComponent: React.FC = () => {
  const { members, loading, error, addMember } = useMembers();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.2276, 2.2137]);
  const [mapZoom, setMapZoom] = useState(6);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', address: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        await addMember({
          name: newMember.name,
          latitude: coordinates[0],
          longitude: coordinates[1],
          address: newMember.address,
          description: newMember.description,
          poste: '',
          ville: '',
          pays: ''
        });
        
        setNewMember({ name: '', address: '', description: '' });
        setShowAddForm(false);
        alert('Membre ajouté avec succès !');
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
                onChange={() => {}} // Désactivé pour la démo
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
