import React from 'react';
import dynamic from 'next/dynamic';

// Import dynamique pour éviter les problèmes SSR avec Leaflet
const SupabaseMapComponent = dynamic(() => import('../components/SupabaseMapComponent'), {
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

const Home: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <SupabaseMapComponent />
    </div>
  );
};

export default Home;
