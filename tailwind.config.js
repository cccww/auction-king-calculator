/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'cyber-primary': '#667eea',
        'cyber-secondary': '#764ba2',
        'cyber-accent': '#f093fb',
        'cyber-cyan': '#00d9ff',
        'cyber-magenta': '#ff00ff',
        'cyber-dark': '#0a0a0e',
        'cyber-deep': '#1a1a2e',
        'cyber-surface': '#16213e',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 217, 255, 0.5)',
        'neon-purple': '0 0 20px rgba(102, 126, 234, 0.5)',
        'neon-pink': '0 0 20px rgba(240, 147, 251, 0.5)',
        'neon-glow': '0 0 40px rgba(102, 126, 234, 0.3)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(102, 126, 234, 0.5)' },
          '100%': { boxShadow: '0 0 40px rgba(102, 126, 234, 0.8)' },
        },
        'pulse-neon': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
