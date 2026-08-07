import React from 'react';
import dynamic from 'next/dynamic';

const SupabaseMapComponent = dynamic(() => import('../components/SupabaseMapComponent'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-screen w-full items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(31,111,122,0.18), transparent 55%), #f7fafb',
      }}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1f6f7a] border-t-transparent" />
        <p className="font-semibold text-[#12263a]">Chargement de la carte…</p>
        <p className="mt-1 text-sm text-[#12263a]/70">FIO-MFI · ICC Online</p>
      </div>
    </div>
  ),
});

const Home: React.FC = () => {
  return (
    <div className="h-screen w-full">
      <SupabaseMapComponent />
    </div>
  );
};

export default Home;
