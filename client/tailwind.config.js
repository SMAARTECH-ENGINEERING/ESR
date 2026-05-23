/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#042EF2",
        btnHover: "#0325C2",
        headerText: "#081021",
        paragraphText: "#515B73",
      },
    },
  },
  plugins: [],
};
