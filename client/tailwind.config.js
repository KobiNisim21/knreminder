/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // BZ Reminder–inspired color palette
      colors: {
        primary: {
          DEFAULT: '#2196F3',  // Blue — section headers, dots, "+" buttons
          light:   '#64B5F6',
          dark:    '#1565C0',
        },
        accent: {
          DEFAULT: '#F44336',  // Red — FAB, overdue indicators
          light:   '#EF9A9A',
          dark:    '#C62828',
        },
        surface: '#FFFFFF',
        background: '#F5F5F5',
        divider: '#E0E0E0',
        textPrimary:   '#212121',
        textSecondary: '#757575',
        textDisabled:  '#BDBDBD',
      },
      fontFamily: {
        // Hebrew-first font stack with excellent RTL support
        sans: [
          'Rubik',          // Google Font — excellent Hebrew support
          'Assistant',      // Hebrew-optimized secondary
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        'time-lg': ['2rem', { lineHeight: '1', fontWeight: '300' }],   // Big time display
        'time-sm': ['0.75rem', { lineHeight: '1', fontWeight: '400' }], // AM/PM
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)', // iOS home bar clearance
        'safe-top':    'env(safe-area-inset-top)',
      },
      borderRadius: {
        'ios': '13px',  // iOS-style card radius
      },
      boxShadow: {
        'ios-card': '0 1px 3px rgba(0,0,0,0.08)',
        'fab':      '0 4px 16px rgba(244,67,54,0.4)',
      },
      animation: {
        'slide-up':   'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-left': 'slideLeft 0.25s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideLeft: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-80px)' },
        },
      },
    },
  },
  plugins: [],
}
