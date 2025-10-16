
import crypto from 'crypto';
import fs from 'fs';

const private_key = Bun.file("../../private_key.pem")
const public_key = Bun.file("../../public_key.pem")
async function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            
        }
    });
    console.log(privateKey, publicKey);


    await Promise.all([
        private_key.write(privateKey as string),
        public_key.write(publicKey as string)

    ])

    console.log('Key pair generated and saved to files "private_key.pem" and "public_key.pem".');
}

generateKeyPair();
