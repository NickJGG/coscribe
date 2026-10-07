import postgres from "postgres"
import { env } from "./env"

/** A direct connection that bypasses RLS: every query here does its own access checks. */
export const sql = postgres(env.databaseUrl, { max: 5 })
