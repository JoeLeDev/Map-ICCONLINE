# 🗺️ Carte Interactive KML

Une application web interactive utilisant Leaflet et Next.js pour visualiser des fichiers KML sur une carte.

## Fonctionnalités

- 🗺️ Carte interactive avec Leaflet
- 📁 Chargement de fichiers KML
- 🗑️ Effacement des données
- 🎯 Centrage automatique sur les données
- 📍 Marqueurs avec popups informatifs
- 🎨 Interface moderne avec Tailwind CSS

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Utilisation

1. **Charger un fichier KML** : Cliquez sur "📁 Charger KML" et sélectionnez un fichier .kml
2. **Visualiser les données** : Les points du fichier KML apparaîtront sur la carte
3. **Interagir avec les marqueurs** : Cliquez sur un marqueur pour voir ses informations
4. **Centrer la carte** : Utilisez le bouton "🎯 Centrer" pour centrer la vue sur les données
5. **Effacer les données** : Utilisez le bouton "🗑️ Effacer" pour supprimer tous les points

## Format KML supporté

L'application supporte les fichiers KML standard avec des éléments `<Placemark>` contenant :
- `<name>` : Nom du point
- `<description>` : Description du point
- `<coordinates>` : Coordonnées géographiques (longitude, latitude)

## Technologies utilisées

- **Next.js** : Framework React
- **Leaflet** : Bibliothèque de cartes interactive
- **React-Leaflet** : Composants React pour Leaflet
- **Tailwind CSS** : Framework CSS
- **TypeScript** : Langage de programmation typé

## Déploiement

L'application peut être déployée sur Vercel, Netlify ou tout autre service de déploiement compatible avec Next.js.
# Map-ICCONLINE
