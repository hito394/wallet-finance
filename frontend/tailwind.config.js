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
        // Dark theme palette (Origin / Monarch style)
        dark: {
          bg:      '#0B0C14',   // page background
          sidebar: '#0E0F1A',   // sidebar
          card:    '#13151F',   // card background
          border:  '#1E2030',   // card border
          hover:   '#1A1C2A',   // hover state
          muted:   '#1E2030',   // muted surface
        },
        brand: {
          50:  '#ede9ff',
          100: '#d5cfff',
          400: '#9d8fff',
          500: '#7C6FFF',       // primary accent
          600: '#6455e0',
          700: '#4e40c7',
        },
        // Semantic colors on dark
        income:  '#4ADE80',     // green
        expense: '#F87171',     // red
        neutral: '#94A3B8',     // gray text
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
