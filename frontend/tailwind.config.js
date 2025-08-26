/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#1A2636', // Deep Navy
        teal: '#197C7C', // Teal Blue
        seafoam: '#3DDAD7', // Seafoam Green
        lightgray: '#F5F7FA', // Light Gray
      },
    },
  },
  plugins: [],
};
