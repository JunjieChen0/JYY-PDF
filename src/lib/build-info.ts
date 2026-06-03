export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ||
  (import.meta.env.APP_VERSION as string | undefined) ||
  '0.0.0'
