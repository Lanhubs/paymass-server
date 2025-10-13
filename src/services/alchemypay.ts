
import { AxiosInstance } from "axios";
import crypto, { UUID } from "crypto";
import alchemyClient from "../utils/alchemyClient";

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
    side: "BUY" | "SELL"

}
export interface OnRampOrderParams extends RampOrderParams{
    address: string
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
    crypto: String,
    network: String,
    fiatCurrency: "NGN" | "KN",
    amount: number,
    side: "BUY" | "SELL"
}

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
        "access-token":"Lanhubs",
        timestamp: "",
        sign: "",
    }

    async createOrder(params: OnRampOrderParams): Promise<CreateOnRampOrderResponse> {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {
            ...params, orderType: 4

        };

        const { data } = await alchemyClient.post("/open/api/v4/merchant/order/create", body, { headers: { ...this.headers, timestamp, sign } });
        return data as CreateOnRampOrderResponse;
    }

    async queryOrder(orderNo: string) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {
            orderNo
        };

        const { data } = await alchemyClient.post("/trade/onramp/query", body, { headers: { ...this.headers, timestamp, sign } });
        return data;
    }

    async createOffRampOrder(params: RampOrderParams): Promise<CreateOnRampOrderResponse> {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {
            ...params,
            orderType: 6
        };

        const { data } = await alchemyClient.post("/open/api/v4/merchant/order/create", body, { headers: { ...this.headers, timestamp, sign } });
        return data as CreateOnRampOrderResponse;
    }

    async queryOffRampOrder(orderNo: string) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);

        const body = {

            orderNo,
        };

        const { data } = await alchemyClient.post("/trade/onramp/query", body, { headers: { ...this.headers, timestamp, sign } });
        return data;
    }

    async queryForRates(payload: RatesPayload) {
        const timestamp = Date.now().toString();
        const sign = this.makeSign(timestamp);
        const { data } = await alchemyClient.post("", payload, { headers: { ...this.headers, timestamp, sign } })
        return data
    }
}





