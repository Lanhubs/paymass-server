
const crypto = require('crypto');

const fs = require('fs');

function generateKeyPair() {
     const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });

     fs.writeFileSync('../../private_key.pem', privateKey.export({
        type: 'pkcs1',
        format: 'pem'
    }));

    fs.writeFileSync('../../public_key.pem', publicKey.export({
        type: 'spki',
        format: 'pem'
    }));

    console.log('Key pair generated and saved to files "private_key.pem" and "public_key.pem".');
}

generateKeyPair();
