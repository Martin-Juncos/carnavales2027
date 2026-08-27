import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#050713',
          900: '#080b16',
          800: '#10172a',
          700: '#1e293b',
        },
        carnival: {
          gold: '#f8c94a',
          cyan: '#22d3ee',
          violet: '#a78bfa',
          coral: '#fb7185',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(248, 201, 74, 0.18), 0 22px 80px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config
