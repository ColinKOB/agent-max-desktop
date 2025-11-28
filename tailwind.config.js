/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: [
        '"SF Pro Display"',
        '"SF Pro Text"',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'sans-serif',
      ],
    },
    extend: {
      colors: {
        // Brand colors from tokens - Light Theme
        'brand-bg': '#F7F9FB',
        'brand-surface': '#FFFFFF',
        'brand-subsurface': '#F1F4F8',
        'brand-border': '#E5EAF0',
        'brand-text': '#0B1220',
        'brand-muted': '#49566A',
        'brand-accent': {
          DEFAULT: '#0FB5AE',
          hover: '#0AA099',
          press: '#099188',
        },
        'brand-danger': '#D13B3B',
        'brand-warning': '#B86E00',
        'brand-success': '#1D966A',
        // Legacy primary (for compatibility)
        primary: {
          DEFAULT: '#0FB5AE',
          dark: '#0AA099',
        },
      },
      spacing: {
        // 8-point grid system
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '24px',
        6: '32px',
        7: '40px',
        8: '48px',
      },
      borderRadius: {
        'brand-sm': '8px',
        'brand-md': '12px',
        'brand-lg': '16px',
        'brand-pill': '999px',
      },
      fontSize: {
        display: ['28px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.2px' }],
        title: ['22px', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.2px' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        mono: ['13px', { lineHeight: '1.6', fontWeight: '400' }],
      },
      transitionDuration: {
        micro: '150ms',
        fast: '180ms',
        base: '200ms',
        slow: '240ms',
        slower: '320ms',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      boxShadow: {
        'brand-sm': 'none',
        'brand-md': 'none',
        'brand-lg': 'none',
        'brand-xl': 'none',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in': 'slideIn 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': {
            transform: 'translateY(10px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
      },
    },
  },
  plugins: [],
};
