// src/utils/generateJWT.ts
import jwt from "jsonwebtoken";
import path from "path";

const KEY_ID = process.env.ALCHEMY_KEY_ID as string;
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH as string;

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export async function generateJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid
  if (cachedToken && tokenExpiry && now < tokenExpiry - 30) {
    return cachedToken;
  }

  // Use the path from environment variables
  const keyPath = path.resolve(PRIVATE_KEY_PATH);
  console.log('Looking for private key at:', keyPath);

  const private_key = Bun.file(keyPath);

  // Check if file exists
  if (!(await private_key.exists())) {
    throw new Error(`Private key file not found at: ${keyPath}`);
  }

  const privateKey = await private_key.text();

  // Trim whitespace and validate key format
  const cleanedKey = privateKey.trim();

  if (!cleanedKey.includes('-----BEGIN') || !cleanedKey.includes('-----END')) {
    throw new Error('Invalid private key format. Expected PEM format with BEGIN/END markers.');
  }

  console.log('Private key loaded successfully, length:', cleanedKey.length);

  const signOptions: jwt.SignOptions = {
    expiresIn: "10m",
    algorithm: "RS256",
    header: {
      kid: KEY_ID,
      alg: "RS256",
    },
  };

  const payload = {}; // Empty payload for Alchemy

  const token = jwt.sign(payload, cleanedKey, signOptions);

  const decoded = jwt.decode(token) as { exp?: number };
  tokenExpiry = decoded?.exp || now + 600;
  cachedToken = token;
  return token;
}