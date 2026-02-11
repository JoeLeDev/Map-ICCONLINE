#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Configuration
const BASE_CSV = path.join(__dirname, '../public/membres-fio-mfi.csv');
const NEW_CSV = path.join(__dirname, '../public/nouveaux-membres.csv');
const OUTPUT_CSV = path.join(__dirname, '../public/membres-fio-mfi-final.csv');
const CACHE_FILE = path.join(__dirname, '../public/geocode-cache.json');

// Cache pour éviter de géocoder plusieurs fois la même adresse
let geocodeCache = new Map<string, [number, number] | null>();

// Interface pour les données CSV
interface CSVData {
  name: string;
  description: string;
  address: string;
  poste: string;
  ville: string;
  pays: string;
  latitude?: number;
  longitude?: number;
}

// Charger le cache existant
function loadCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      geocodeCache = new Map(Object.entries(cacheData));
      console.log(`📦 Cache chargé: ${geocodeCache.size} adresses en cache`);
    }
  } catch (error) {
    console.log('📦 Nouveau cache créé');
  }
}

// Sauvegarder le cache
function saveCache(): void {
  const cacheData = Object.fromEntries(geocodeCache);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  console.log(`💾 Cache sauvegardé: ${geocodeCache.size} adresses`);
}

// Fonction pour géocoder une adresse
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address)!;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    const coordinates = await new Promise<[number, number] | null>((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Smart-CSV-Processor/1.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            if (results.length > 0) {
              resolve([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
            } else {
              resolve(null);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
    
    geocodeCache.set(address, coordinates);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return coordinates;
  } catch (error) {
    console.error(`Erreur de géocodage pour "${address}":`, error);
    geocodeCache.set(address, null);
    return null;
  }
}

// Fonction pour parser un CSV
function parseCSV(csvPath: string): CSVData[] {
  if (!fs.existsSync(csvPath)) {
    console.log(`⚠️  Fichier non trouvé: ${csvPath}`);
    return [];
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');
  const data: CSVData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(value => 
      value.trim().replace(/^"(.*)"$/, '$1')
    );

    if (values.length >= 6) {
      data.push({
        name: values[0],
        description: values[1],
        address: values[2],
        poste: values[3],
        ville: values[4],
        pays: values[5]
      });
    }
  }

  return data;
}

// Fonction pour traiter les nouvelles adresses
async function processNewAddresses(): Promise<void> {
  try {
    console.log('🚀 Début du traitement intelligent...');
    
    // Charger le cache
    loadCache();
    
    // Charger le fichier de base
    const baseData = parseCSV(BASE_CSV);
    console.log(`📊 Fichier de base: ${baseData.length} membres`);
    
    // Charger les nouveaux membres
    const newData = parseCSV(NEW_CSV);
    console.log(`📊 Nouveaux membres: ${newData.length} membres`);
    
    if (newData.length === 0) {
      console.log('⚠️  Aucun nouveau membre à traiter');
      return;
    }
    
    // Traiter seulement les nouvelles adresses
    const processedData = [...baseData];
    let newProcessed = 0;
    let cached = 0;
    
    for (const member of newData) {
      if (!member.address) continue;
      
      console.log(`🔍 Traitement: ${member.name} - ${member.address}`);
      
      // Vérifier si cette adresse existe déjà dans le fichier de base
      const exists = baseData.some(base => 
        base.address.toLowerCase() === member.address.toLowerCase()
      );
      
      if (exists) {
        console.log(`⏭️  Adresse déjà existante: ${member.address}`);
        cached++;
        continue;
      }
      
      // Géocoder seulement si pas en cache
      const coordinates = await geocodeAddress(member.address);
      
      if (coordinates) {
        processedData.push({
          ...member,
          latitude: coordinates[0],
          longitude: coordinates[1]
        });
        newProcessed++;
        console.log(`✅ Nouveau membre ajouté: ${member.name}`);
      } else {
        console.log(`❌ Impossible de géocoder: ${member.address}`);
      }
    }
    
    // Sauvegarder le fichier final
    const csvOutput = [
      'name,latitude,longitude,address,description,poste,ville,pays',
      ...processedData.map(row => 
        `"${row.name}","${row.latitude || 0}","${row.longitude || 0}","${row.address}","${row.description}","${row.poste}","${row.ville}","${row.pays}"`
      )
    ].join('\n');
    
    fs.writeFileSync(OUTPUT_CSV, csvOutput, 'utf8');
    
    // Sauvegarder le cache
    saveCache();
    
    console.log(`\n🎉 Traitement terminé !`);
    console.log(`✅ Nouveaux membres traités: ${newProcessed}`);
    console.log(`⏭️  Adresses déjà existantes: ${cached}`);
    console.log(`📊 Total final: ${processedData.length} membres`);
    console.log(`📄 Fichier créé: ${OUTPUT_CSV}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter
if (require.main === module) {
  processNewAddresses();
}

export { processNewAddresses, geocodeAddress };
