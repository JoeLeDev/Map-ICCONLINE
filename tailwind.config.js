/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fio: {
          ink: '#12263a',
          sea: '#1f6f7a',
          'sea-deep': '#16555e',
          mist: '#e7eef2',
          paper: '#f7fafb',
          accent: '#c47a2c',
          line: 'rgba(18, 38, 58, 0.12)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 10px 30px rgba(18, 38, 58, 0.08)',
      },
    },
  },
  plugins: [],
};
