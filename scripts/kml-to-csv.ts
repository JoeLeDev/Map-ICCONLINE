#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Configuration
const INPUT_KML = path.join(__dirname, '../public/Membres des FIO-MFI (4).kml');
const OUTPUT_CSV = path.join(__dirname, '../public/membres-fio-mfi.csv');

// Cache pour éviter de géocoder plusieurs fois la même adresse
const geocodeCache = new Map<string, [number, number] | null>();

// Interface pour les données KML
interface KMLData {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  poste: string;
  ville: string;
  pays: string;
}

// Fonction pour géocoder une adresse via l'API Nominatim (OpenStreetMap)
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  // Vérifier le cache d'abord
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address)!;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
    
    const coordinates = await new Promise<[number, number] | null>((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'KML-to-CSV-Converter/1.0' } }, (res) => {
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
    
    // Mettre en cache le résultat
    geocodeCache.set(address, coordinates);
    
    // Petite pause pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return coordinates;
  } catch (error) {
    console.error(`Erreur de géocodage pour "${address}":`, error);
    geocodeCache.set(address, null);
    return null;
  }
}

// Fonction pour parser le fichier KML
async function parseKML(kmlText: string): Promise<KMLData[]> {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(kmlText, { contentType: 'text/xml' });
  const kmlDoc = dom.window.document;
  
  const placemarks = kmlDoc.querySelectorAll('Placemark');
  const data: KMLData[] = [];
  const total = placemarks.length;

  console.log(`📊 Traitement de ${total} points...`);

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const nameElement = placemark.querySelector('name');
    const descriptionElement = placemark.querySelector('description');
    const addressElement = placemark.querySelector('address');
    
    const name = nameElement?.textContent || 'Point sans nom';
    const address = addressElement?.textContent?.trim();
    
    // Nettoyer la description HTML
    let description = descriptionElement?.textContent || '';
    if (description.includes('<br>')) {
      description = description.replace(/<br>/g, ' | ');
    }
    
    let coordinates: [number, number] | null = null;
    
    if (address) {
      console.log(`🔍 Géocodage ${i + 1}/${total}: ${address}`);
      coordinates = await geocodeAddress(address);
    }
    
    if (coordinates) {
      data.push({
        name: name,
        latitude: coordinates[0],
        longitude: coordinates[1],
        address: address || '',
        description: description,
        poste: 'Membre',
        ville: address?.split(' ')[0] || '',
        pays: address?.split(' ').slice(1).join(' ') || ''
      });
      console.log(`✅ ${name}: ${coordinates[0]}, ${coordinates[1]}`);
    } else {
      console.log(`❌ Impossible de géocoder: ${address}`);
    }
  }

  return data;
}

// Fonction pour sauvegarder en CSV
function saveToCSV(data: KMLData[], filename: string): void {
  const headers = ['name', 'latitude', 'longitude', 'address', 'description', 'poste', 'ville', 'pays'];
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header as keyof KMLData] || '';
        // Échapper les virgules et guillemets dans les valeurs
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');
  
  fs.writeFileSync(filename, csvContent, 'utf8');
  console.log(`💾 CSV sauvegardé: ${filename}`);
}

// Fonction principale
async function main(): Promise<void> {
  try {
    console.log('🚀 Début de la conversion KML vers CSV...');
    console.log(`📁 Fichier d'entrée: ${INPUT_KML}`);
    console.log(`📁 Fichier de sortie: ${OUTPUT_CSV}`);
    
    // Lire le fichier KML
    const kmlText = fs.readFileSync(INPUT_KML, 'utf8');
    
    // Parser et géocoder
    const data = await parseKML(kmlText);
    
    console.log(`\n📊 Résultats:`);
    console.log(`✅ Points géocodés avec succès: ${data.length}`);
    console.log(`❌ Points échoués: ${(await parseKML(kmlText)).length - data.length}`);
    
    if (data.length > 0) {
      // Sauvegarder en CSV
      saveToCSV(data, OUTPUT_CSV);
      
      console.log(`\n🎉 Conversion terminée !`);
      console.log(`📄 Fichier CSV créé: ${OUTPUT_CSV}`);
      console.log(`\n💡 Vous pouvez maintenant utiliser ce fichier CSV dans votre application !`);
    } else {
      console.log('❌ Aucun point n\'a pu être géocodé.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la conversion:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

export { parseKML, geocodeAddress, saveToCSV };
