import React from 'react';
import dynamic from 'next/dynamic';

// Import dynamique pour éviter les erreurs SSR avec Leaflet
const EmbedMapComponent = dynamic(() => import('../components/EmbedMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de la carte...</p>
      </div>
    </div>
  )
});

const EmbedPage: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <EmbedMapComponent />
    </div>
  );
};

export default EmbedPage;
