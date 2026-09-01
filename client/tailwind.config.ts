import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#1A4A2E',
          900: '#205537',
          800: '#276341',
          700: '#2E6B45',
        },
        carnival: {
          'verde-oscuro': '#1A4A2E',
          'verde-menta': '#2E6B45',
          'naranja-calido': '#FDA230',
          'rojo-vibrante': '#FB5D29',
          rosa: '#F03173',
          lila: '#9D89DF',
          'azul-profundo': '#4787BB',
          'amarillo-brillante': '#FFD700',
          blanco: '#FFFFFF',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(253, 162, 48, 0.18), 0 22px 80px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config
