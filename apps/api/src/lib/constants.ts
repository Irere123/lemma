export const isProduction = process.env.NODE_ENV === 'production'

export const BASE_URL = isProduction ? 'https://api.irere.dev' : 'http://localhost:4000'
