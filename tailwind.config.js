// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/app/profile.jsx" // Specifically ensuring your profile path is covered
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10b981', // Emerald accent for DirectRent
      },
    },
  },
  plugins: [],
};