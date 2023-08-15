/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}", "./*.html"],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        'body': '#F5F5F5',
        'selected-text': '#F05454',
        'theme': '#30475E',
        'button': '#121212'
      },
      fontFamily: {
        'poppins': ["'Poppins'", 'sans-serif']
      }
    },
  },
  plugins: [],
}
