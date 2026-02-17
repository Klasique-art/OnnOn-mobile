/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#571217",      // Deep Brown
        secondary: "#1A760D",    // Green
        accent: "#F38218",       // Orange
      },
    },
  },
  plugins: [],
}