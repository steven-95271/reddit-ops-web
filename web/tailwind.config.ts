import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#030303',
          card: '#1A1A1B',
          border: '#343536',
          hover: '#272729',
          text: '#FFFFFF',
          muted: '#a5a6a7',
          input: '#272729',
        },
        reddit: {
          orange: '#FF4500',
          dark: '#030303',
          card: '#1A1A1B',
          bg: '#030303',
          border: '#343536',
          hover: '#272729',
          text: '#FFFFFF',
          muted: '#a5a6a7',
          downvote: '#BE2B1D',
          upvote: '#FF4500',
          blue: '#0079D3',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
      },
      boxShadow: {
        'reddit': '0 1px 2px rgba(0,0,0,0.3)',
        'reddit-hover': '0 2px 4px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
