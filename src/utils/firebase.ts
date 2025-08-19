import firebase from "firebase-admin"
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, './path/to/your/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
});
export const firebaseAdmin = firebase