/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'deep-forest':   '#1a3b1a',
        'forest-green':  '#2d5016',
        'emerald-leaf':  '#228b22',
        'sage-green':    '#87a96b',
        'mint-light':    '#b8d4b8',
        'cream-white':   '#faf8f3',
        'warm-beige':    '#f4f1eb',
        'earth-brown':   '#8b6f47',
        'text-primary':  '#1a3b1a',
        'text-secondary':'#2d5016',
        'text-muted':    '#5a6b5a',
        'accent-gold':   '#d4af37',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        'xl2': '24px',
      },
      backdropBlur: {
        botanical: '12px',
      },
    },
  },
  plugins: [],
};

