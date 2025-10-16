import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import { generalRateLimit } from "../middleware/security";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import crypto, { UUID } from "crypto";
import { WalletService } from "../services/walletService";
import { PrismaClient } from "@prisma/client";
import { transactionStatusTracker } from "../hooks/offramp-hooks";
import alchemyClient from "../utils/alchemyClient";

const router = Router();
const prisma = new PrismaClient();

// AlchemyPay Service Configuration and Interfaces
interface OnRampConfig {
    appId: string;
    appSecret: string;
}

const config: OnRampConfig = {
    appId: process.env.ALCHEMY_APP_ID as string,
    appSecret: process.env.ALCHEMY_APP_SECRET as string
}

export interface RampOrderParams {
    fiatCurrency: string;
    amount: string;
    cryptoCurrency: string;
    userAccountId: UUID | string;
    payWayCode: string;
    network: string;
    redirectUrl: string;
    callbackUrl: string;
    merchantOrderNo: string;
    name: string;
    picture?: string;
    side: "BUY" | "SELL";
}

export interface OnRampOrderParams extends RampOrderParams {
    address: string;
}

export interface CreateOnRampOrderResponse {
    success: boolean;
    returnCode: string;
    returnMsg: string;
    data?: {
        orderNo: string;
        payUrl: string;
    };
    traceId?: string;
}

export interface RatesPayload {
    crypto: string;
    network: string;
    fiatCurrency: "NGN" | "KN";
    amount: number;
    side: "BUY" | "SELL";
}

// AlchemyPay Service Class
export class OnRampService {
    private makeSign(timestamp: string): string {
        const { appId, appSecret } = config;
        return crypto
            .createHash("sha1")
            .update(appId + appSecret + timestamp)
            .digest("hex");
    }

    headers = {
        appId: config.appId,
        timestamp: "",
        sign: "",
    }

    async createOrder(params: OnRampOrderParams): Promise<CreateOnRampOrderResponse> {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {
            ...params,
            orderType: 4
        };

        const { data } = await alchemyClient.post("/open/api/v4/merchant/order/create", body, {
            headers: { ...this.headers, timestamp, sign }
        });
        return data as CreateOnRampOrderResponse;
    }

    async queryOrder(orderNo: string) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = { orderNo };

        const { data } = await alchemyClient.post("/trade/onramp/query", body, {
            headers: { ...this.headers, timestamp, sign }
        });
        return data;
    }

    async createOffRampOrder(params: RampOrderParams): Promise<CreateOnRampOrderResponse> {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {
            ...params,
            orderType: 6
        };

        const { data } = await alchemyClient.post("/open/api/v4/merchant/order/create", body, {
            headers: { ...this.headers, timestamp, sign }
        });
        return data as CreateOnRampOrderResponse;
    }

    async queryOffRampOrder(orderNo: string) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = { orderNo };

        const { data } = await alchemyClient.post("/trade/onramp/query", body, {
            headers: { ...this.headers, timestamp, sign }
        });
        return data;
    }

    async queryForRates(payload: RatesPayload) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);
        const { data } = await alchemyClient.post("/open/api/v4/merchant/rate/query", payload, {
            headers: { ...this.headers, timestamp, sign }
        });
        return data;
    }
}

// Initialize service instance
const onRampService = new OnRampService();

// Get exchange rates
router.post(
    "/rates",
    generalRateLimit,
    authenticateToken,
    async (req: Request, res: Response) => {
        try {
            console.log(req.body)
            const { crypto, network, fiatCurrency, amount, side } = req.body;
            if (!crypto || !network || !fiatCurrency || !amount || !side) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required parameters: crypto, network, fiatCurrency, amount, side",
                });
            }

            const rates = await onRampService.queryForRates({
                crypto,
                network,
                fiatCurrency,
                amount: parseFloat(amount),
                side,
            });
            res.json(rates);
        } catch (error: any) {
            logger.error(`Rate fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
);

// Create onramp order
router.post(
    "/onramp/orders",
    generalRateLimit,
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const {
                fiatCurrency,
                amount,
                cryptoCurrency,
                payWayCode,
                network,
                redirectUrl,
                callbackUrl,
                merchantOrderNo,
                name,
                address,
                picture,
                side
            } = req.body;

            if (!fiatCurrency || !amount || !cryptoCurrency || !payWayCode || !network || !address) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields",
                });
            }

            const orderParams: OnRampOrderParams = {
                fiatCurrency,
                amount,
                cryptoCurrency,
                userAccountId: req.user?.userId as UUID,
                payWayCode,
                network,
                redirectUrl: redirectUrl || "",
                callbackUrl: callbackUrl || "",
                merchantOrderNo: merchantOrderNo || crypto.randomUUID(),
                name,
                address,
                picture,
                side: side || "BUY"
            };

            const order = await onRampService.createOrder(orderParams);
            res.json(order);
        } catch (error: any) {
            logger.error(`Onramp order creation error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
);

// Create offramp order
router.post(
    "/offramp/orders",
    generalRateLimit,
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const {
                fiatCurrency,
                amount,
                cryptoCurrency,
                payWayCode,
                network,
                redirectUrl,
                callbackUrl,
                merchantOrderNo,
                name,
                picture,
                side
            } = req.body;

            if (!fiatCurrency || !amount || !cryptoCurrency || !payWayCode || !network) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields",
                });
            }

            const orderParams: RampOrderParams = {
                fiatCurrency,
                amount,
                cryptoCurrency,
                userAccountId: req.user?.userId as UUID,
                payWayCode,
                network,
                redirectUrl: redirectUrl || "",
                callbackUrl: callbackUrl || "",
                merchantOrderNo: merchantOrderNo || crypto.randomUUID(),
                name,
                picture,
                side: side || "SELL"
            };

            const order = await onRampService.createOffRampOrder(orderParams);
            res.json(order);
        } catch (error: any) {
            logger.error(`Offramp order creation error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
);

// Get onramp order status
router.get(
    "/onramp/orders/:orderNo",
    generalRateLimit,
    authenticateToken,
    async (req: Request, res: Response) => {
        try {
            const { orderNo } = req.params;

            if (!orderNo) {
                return res.status(400).json({
                    success: false,
                    message: "Order number is required",
                });
            }

            const order = await onRampService.queryOrder(orderNo);
            res.json(order);
        } catch (error: any) {
            logger.error(`Onramp order status fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
);

// Get offramp order status
router.get(
    "/offramp/orders/:orderNo",
    generalRateLimit,
    authenticateToken,
    async (req: Request, res: Response) => {
        try {
            const { orderNo } = req.params;

            if (!orderNo) {
                return res.status(400).json({
                    success: false,
                    message: "Order number is required",
                });
            }

            const order = await onRampService.queryOffRampOrder(orderNo);
            res.json(order);
        } catch (error: any) {
            logger.error(`Offramp order status fetch error: ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
);

router.post("/verify-offramp-transaction", transactionStatusTracker);
const alchemyRampsRoutes =router
export default alchemyRampsRoutes;
