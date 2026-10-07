try {
  process.loadEnvFile()
} catch {
  // No .env file: production sets the real environment.
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 1234),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL").replace(/\/$/, ""),
  syncSecret: required("SYNC_SECRET"),
}
