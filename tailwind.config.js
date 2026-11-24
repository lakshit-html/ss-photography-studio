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
        brand: {
          50: '#FBF9F5',
          100: '#F5F1E8',
          200: '#EADEC9',
          300: '#DCC7A4',
          400: '#CAA87A',
          500: '#B88E56',
          600: '#9E7441',
          700: '#7E5B33',
          800: '#5C4227',
          900: '#3D2B1B',
          950: '#1F140B',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        luxury: '0.2em',
        editorial: '0.12em',
      },
    },
  },
  plugins: [],
};
