import type { Config } from 'tailwindcss'

// Palette and type are pulled from public/css/irmaks.webflow.css so the booking
// page reads as part of the existing site rather than a bolted-on product.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#2b3f58', // --primary
          light: '#3a5273', // lifted panel against the navy page
          deep: '#1e2d40', // nav bar, sits darker than the page
        },
        gold: '#fed363', // --gold
        ink: '#202020', // --black
      },
      fontFamily: {
        // The site asks Webflow for Droid Serif, which Google retired; Noto
        // Serif is its direct successor and the practical fallback.
        serif: ['"Droid Serif"', '"Noto Serif"', 'Georgia', 'serif'],
        sans: ['"Open Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        cta: '5px', // matches .button-cta
      },
    },
  },
  plugins: [],
}

export default config
