import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        reddit: {
          orange: '#FF4500',
          dark: '#030303',
          card: '#FFFFFF',
          bg: '#F6F7F8',
          border: '#E5E5E5',
          hover: '#F0F0F0',
          text: '#1A1A1B',
          muted: '#787C7E',
          downvote: '#BE2B1D',
          upvote: '#FF4500',
         社区蓝: '#0079D3',
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
        'reddit': '0 1px 2px rgba(0,0,0,0.1)',
        'reddit-hover': '0 2px 4px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
export default config
