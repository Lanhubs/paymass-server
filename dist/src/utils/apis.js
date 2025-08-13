import axios from 'axios';
const blockradar = axios.create({
    baseURL: process.env.BLOCKRADAR_BASE_URL,
    headers: {
        'x-api-key': process.env.BLOCKRADAR_API_KEY ?? "",
        'Content-Type': 'application/json'
    },
    timeout: 30000
});
const paycrest = axios.create({
    baseURL: process.env.PAYCREST_BASE_URL,
    headers: {
        'API-Key': process.env.PAYCREST_API_KEY ?? "",
        'Content-Type': 'application/json'
    },
    timeout: 30000
});
const paystack = axios.create({
    baseURL: process.env.PAYSTACK_BASE_URL,
    headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    },
    timeout: 30000
});
export { blockradar, paycrest, paystack };
//# sourceMappingURL=apis.js.map