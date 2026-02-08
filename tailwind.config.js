/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          soft: 'var(--color-primary-soft)',
        },
        'on-primary': 'var(--color-on-primary)',
        // Semantic Colors
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        // Background & Surface
        bg: {
          app: 'var(--color-bg-app)',
          sidebar: 'var(--color-sidebar)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
        },
        // Typography
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
        },
        // Input
        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          focus: 'var(--color-input-focus)',
          placeholder: 'var(--color-input-placeholder)',
        },
        // HTTP Methods
        method: {
          get: 'var(--color-method-get)',
          post: 'var(--color-method-post)',
          put: 'var(--color-method-put)',
          patch: 'var(--color-method-patch)',
          delete: 'var(--color-method-delete)',
        },
        // Status Colors
        status: {
          '2xx': 'var(--color-status-2xx)',
          '3xx': 'var(--color-status-3xx)',
          '4xx': 'var(--color-status-4xx)',
          '5xx': 'var(--color-status-5xx)',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 1s infinite',
      },
    },
  },
  plugins: [],
}
