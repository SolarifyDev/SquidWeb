/** @type {import('tailwindcss').Config} */

export default {
  content: ['./src/**/*.{mjs,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'squid-blue': '#0d80d8',
        'squid-dark': '#0a151e',
        'squid-green': '#00B065',
        'squid-sidebar': '#f5f6f8',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        'card-hover': '0 6px 20px rgba(15,23,42,0.08)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pop: { '0%': { transform: 'scale(0.7)', opacity: '0' }, '60%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { transform: 'scale(1)', opacity: '0.5' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
        indeterminate: { '0%': { left: '-45%' }, '100%': { left: '100%' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease both',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.2,0.7,0.2,1) both',
        pop: 'pop 0.42s cubic-bezier(0.2,0.8,0.2,1.2) both',
        shimmer: 'shimmer 1.5s infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
      },
    }
  },
  plugins: []
}
