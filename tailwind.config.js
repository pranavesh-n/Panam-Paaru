/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#FFFDF5',
          dark: '#121212',
          yellow: '#FFE600',
          green: '#2EE59D',
          emerald: '#05DF72',
          red: '#FF4343',
          purple: '#9B51E0',
          blue: '#0066FF',
          cyan: '#00F0FF',
          pink: '#FF4D8D',
          orange: '#FF8800',
          muted: '#EAE5D9',
          border: '#121212',
          card: '#FFFFFF',
        }
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px #121212',
        'neo-sm': '2px 2px 0px 0px #121212',
        'neo-lg': '6px 6px 0px 0px #121212',
        'neo-xl': '8px 8px 0px 0px #121212',
        'neo-hover': '2px 2px 0px 0px #121212',
        'neo-yellow': '4px 4px 0px 0px #FFE600',
        'neo-green': '4px 4px 0px 0px #2EE59D',
        'neo-red': '4px 4px 0px 0px #FF4343',
      },
      borderWidth: {
        '3': '3px',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Cabinet Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
