// src/utils/generateJWT.ts
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";

// Load environment variables
require('dotenv').config();

const KEY_ID = process.env.ALCHEMY_KEY_ID as string; // from Alchemy Dashboard
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH as string;

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid
  if (cachedToken && tokenExpiry && now < tokenExpiry - 30) {
    return cachedToken;
  }

  const privateKey = fs.readFileSync("../../private_key.pem", 'utf8');

  const signOptions: jwt.SignOptions = {
    algorithm: "RS256",
    expiresIn: "10m",
    header: {
      kid: KEY_ID,
      alg:"RS256"
    },
  };

  const payload = {}; // Empty payload for Alchemy

  const token = jwt.sign(payload, privateKey, signOptions);

  const decoded = jwt.decode(token) as { exp?: number };
  tokenExpiry = decoded?.exp || now + 600;
  cachedToken = token;
  return token;
}