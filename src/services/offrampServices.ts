import { UUID } from "crypto";
import { paycrest, paystack } from "../utils/apis";
import { logger } from "../utils/logger.js";
import { WalletService } from "./walletService";
import crypto from "crypto";

// Paycrest API interfaces based on their documentation
interface PaycrestRatesPayload {
  token: string;
  amount: number;
  currency: string;
}

interface PaycrestRecipient {
  institution: string;
  accountIdentifier: string;
  accountName: string;
  currency: string;
  memo?: string;
}

interface PaycrestOrderPayload {
  amount: number;
  token: string;
  network: string;
  rate: number|string;
  recipient: PaycrestRecipient;
  reference: string;
  returnAddress: string;
  memo?: string;
  userId: UUID;
}

interface PaycrestRateResponse {
  success: boolean;
  data: {
    rate: number;
    fee: number;
    totalAmount: number;
    currency: string;
    token: string;
  };
}

interface PaycrestOrderResponse {
  success: boolean;
  data: {
    id: string;
    reference: string;
    status: string;
    amount: number;
    token: string;
    network: string;
    rate: number;
    recipient: PaycrestRecipient;
    receiveAddress: string;
    expiresAt: string;
    createdAt: string;
  };
}

interface BankDetails {
  accountNumber: string;
  bankCode: string;
  bank: string;
}
class offrampServices {
  static async fetchRates({
    amount,
    currency,
    token,
  }: PaycrestRatesPayload): Promise<PaycrestRateResponse> {
    try {
      const response = await paycrest.get(
        `/rates/${token}/${amount}/${currency}`,
        {
          headers: {
            disableAuth: false,
          },
        }
      );
      if (response.status === 200 && response.data.status === "success") {
        logger.info(
          `Rate fetched successfully for ${token}: ${JSON.stringify(
            response.data
          )}`
        );
        return response.data;
      } else {
        logger.error(
          `Rate fetch failed: ${response.data.message || "Unknown error"}`
        );
        throw new Error(
          `Rate fetch failed: ${response.data.message || "Unknown error"}`
        );
      }
    } catch (error: any) {
      logger.error(`Rate fetch error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Rate fetch failed";
        throw new Error(`Rate fetch failed: ${errorMessage}`);
      }
      throw new Error(`Rate fetch failed: ${error.message}`);
    }
  }

  static async initializeOrder({
    amount,
    token,
    network,
    rate,
    recipient,
    reference,
    returnAddress,
    memo,
    userId
  }: PaycrestOrderPayload): Promise<PaycrestOrderResponse> {
    try {
      const payload = {
        amount,
        token,
        network,
        rate,
        recipient: {
          ...recipient,
          memo: memo ? memo : ""
        },
        reference,
        returnAddress,
      };

      logger.info(
        `Initializing order with payload: ${JSON.stringify(payload)}`
      );

      const response = await paycrest.post(`/sender/orders`, payload);
      

      if ((response.status === 200 || 201) && response.data.status === "success") {
        const order = response.data;
        logger.info(
          `Order initialized successfully: ${JSON.stringify(order.data)}`
        );
        
        return order;
      } else {
        logger.error(
          `Order initialization failed: ${
            response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Order initialization failed: ${
            response.data.message || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
        console.error(error);
      logger.error(`Order initialization error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Order initialization failed";
        throw new Error(`Order initialization failed: ${errorMessage}`);
      }
      throw new Error(`Order initialization failed: ${error.message}`);
    }
  }

  static async getOrderStatus(orderId: string): Promise<PaycrestOrderResponse> {
    try {
      const response = await paycrest.get(`/sender/orders/${orderId}`);

      if (response.status === 200 && response.data.success) {
        logger.info(
          `Order status retrieved: ${JSON.stringify(response.data.data)}`
        );
        return response.data;
      } else {
        logger.error(
          `Order status fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Order status fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
      logger.error(`Order status fetch error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Order status fetch failed";
        throw new Error(`Order status fetch failed: ${errorMessage}`);
      }
      throw new Error(`Order status fetch failed: ${error.message}`);
    }
  }

  static async getSupportedTokens(): Promise<any> {
    try {
      const response = await paycrest.get(`/sender/tokens`);

      if (response.status === 200 && response.data.success) {
        logger.info(
          `Supported tokens retrieved: ${JSON.stringify(response.data.data)}`
        );
        return response.data;
      } else {
        logger.error(
          `Supported tokens fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Supported tokens fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
      logger.error(`Supported tokens fetch error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Supported tokens fetch failed";
        throw new Error(`Supported tokens fetch failed: ${errorMessage}`);
      }
      throw new Error(`Supported tokens fetch failed: ${error.message}`);
    }
  }
  static async getSupportedCurrencies(): Promise<any> {
    try {
      const response = await paycrest.get(`/sender/currencies`);

      if (response.status === 200 && response.data.success) {
        logger.info(
          `Supported currencies retrieved: ${JSON.stringify(
            response.data.data
          )}`
        );
        return response.data;
      } else {
        logger.error(
          `Supported currencies fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Supported currencies fetch failed: ${
            response.data.message || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
      logger.error(`Supported currencies fetch error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Supported currencies fetch failed";
        throw new Error(`Supported currencies fetch failed: ${errorMessage}`);
      }
      throw new Error(`Supported currencies fetch failed: ${error.message}`);
    }
  }
  static async verifyAccountNumber({ accountNumber, bankCode }: BankDetails) {
    try {
      const response = await paystack.get(`/bank/resolve`, {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      if (response.status === 200 && response.data.status) {
        const account = response.data.data;
        logger.info(
          `Account verification successful: ${JSON.stringify(account)}`
        );
        return {
          success: true,
          data: {
            accountNumber: account.account_number,
            accountName: account.account_name,
            bankId: account.bank_id,
          },
        };
      } else {
        logger.error(
          `Account verification failed: ${
            response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Account verification failed: ${
            response.data.message || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
      logger.error(`Account verification error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Account verification failed";
        throw new Error(`Account verification failed: ${errorMessage}`);
      }
      throw new Error(`Account verification failed: ${error.message}`);
    }
  }

  static async getBanks(): Promise<any> {
    try {
      const response = await paycrest.get("/institutions/NGN");

      if (response.status === 200 && response.data.status) {
        logger.info(`Banks retrieved: ${JSON.stringify(response.data.data)}`);
        return response.data;
      } else {
        logger.error(
          `Banks fetch failed: ${response.data.message || "Unknown error"}`
        );
        throw new Error(
          `Banks fetch failed: ${response.data.message || "Unknown error"}`
        );
      }
    } catch (error: any) {
      logger.error(`Banks fetch error: ${error.message}`);
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          "Banks fetch failed";
        throw new Error(`Banks fetch failed: ${errorMessage}`);
      }
      throw new Error(`Banks fetch failed: ${error.message}`);
    }
  }






}

export default offrampServices;
