/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0F172A', soft: '#334155', muted: '#475569', faint: '#64748B' },
        canvas: '#EEF2F7',
        brand: { 50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A' },
        mention: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '28px' },
      boxShadow: {
        glass: '0 10px 30px -12px rgba(15,23,42,.14)',
        lift: '0 14px 30px -14px rgba(37,99,235,.35)',
        cta: '0 14px 28px -12px rgba(37,99,235,.7)',
      },
      keyframes: {
        drift: { from: { transform: 'translate(0,0) scale(1)' }, to: { transform: 'translate(50px,-30px) scale(1.1)' } },
        dot: { '0%,80%,100%': { opacity: '.3', transform: 'translateY(0)' }, '40%': { opacity: '1', transform: 'translateY(-3px)' } },
        flash: { '0%,100%': { backgroundColor: 'transparent' }, '20%,60%': { backgroundColor: '#FEF3C7' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pop: { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        drift: 'drift 20s ease-in-out infinite alternate',
        dot: 'dot 1.2s infinite',
        flash: 'flash 2.4s ease-in-out',
        rise: 'rise .25s ease-out both',
        pop: 'pop .18s ease-out both',
      },
    },
  },
  plugins: [],
};
