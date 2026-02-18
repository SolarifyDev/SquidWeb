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
      }
    }
  },
  plugins: []
}
