// src/lib/alchemyClient.ts
import axios, { AxiosInstance } from "axios";
import { generateJWT } from "../utils/generateAlchemyJWT";

const alchemyClient = axios.create({
    baseURL: process.env.ALCHEMY_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add interceptor to attach JWT
alchemyClient.interceptors.request.use((config: any) => {
    const token = generateJWT();

    return {
        ...config.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
});
export default alchemyClient
