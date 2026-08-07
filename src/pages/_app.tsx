import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Carte des membres FIO-MFI</title>
        <meta
          name="description"
          content="Carte interactive des membres FIO-MFI — consultation et mise à jour."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-sans: 'Manrope', system-ui, sans-serif;
            --font-display: 'Fraunces', Georgia, serif;
          }
        `}</style>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
