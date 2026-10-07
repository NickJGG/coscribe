import { createRemoteJWKSet, jwtVerify } from "jose"
import { env } from "./env"

const issuer = `${env.supabaseUrl}/auth/v1`
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

/** The user id from a Supabase access token. Throws if the token is invalid or expired. */
export async function verifyUser(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: "authenticated" })
  if (!payload.sub) throw new Error("token has no subject")
  return payload.sub
}
