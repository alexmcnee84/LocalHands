/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          glow: '#00ffff',
        },
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)',
        'cyan-glow-lg': '0 0 30px rgba(0, 255, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.4)',
      },
    },
  },
  plugins: [],
}

