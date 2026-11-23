/** Identidad visual "Telón": ciruela profunda, oro ocre y tierra sobre papel lila. */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#1e0f2b',                                   // texto principal (ciruela casi negra)
        plum: { 900: '#2b1240', 700: '#4a1d5c', 500: '#7a3b8f', 200: '#d9c3e2', 100: '#ece0f1' },
        gold: { 600: '#a87a22', 500: '#c99a3b', 300: '#e3c27a' },
        earth: { 700: '#5c3a26', 600: '#7b4f34', 100: '#efe3d6' },
        paper: '#f6f1f7',                                 // fondo (blanco teñido de lila)
        ok: '#2f7d5b',
        warn: '#b4690e',
        danger: '#b3261e',
      },
      fontFamily: {
        display: ['"Young Serif"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,18,64,.08), 0 8px 24px -12px rgba(43,18,64,.25)',
        lift: '0 2px 4px rgba(43,18,64,.1), 0 18px 36px -14px rgba(43,18,64,.4)',
      },
      keyframes: {
        'stamp-in': { '0%': { opacity: 0, transform: 'scale(1.8) rotate(-12deg)' }, '60%': { opacity: 1, transform: 'scale(.95) rotate(-6deg)' }, '100%': { opacity: 1, transform: 'scale(1) rotate(-6deg)' } },
        'pop-in': { '0%': { opacity: 0, transform: 'translateY(8px) scale(.96)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'stamp-in': 'stamp-in .55s cubic-bezier(.2,.9,.3,1) both',
        'pop-in': 'pop-in .22s ease-out both',
      },
    },
  },
  plugins: [],
};
