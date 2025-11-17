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
  rate: number | string;
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
  bankName: string;
  accountName: string;
  bankCode?: string; // Optional: Paycrest bank code (not used for Paystack verification)
}

interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
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
          `Order initialization failed: ${response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Order initialization failed: ${response.data.message || "Unknown error"
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
          `Order status fetch failed: ${response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Order status fetch failed: ${response.data.message || "Unknown error"
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
          `Supported tokens fetch failed: ${response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Supported tokens fetch failed: ${response.data.message || "Unknown error"
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
          `Supported currencies fetch failed: ${response.data.message || "Unknown error"
          }`
        );
        throw new Error(
          `Supported currencies fetch failed: ${response.data.message || "Unknown error"
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
  static async verifyAccountNumber({ accountNumber, bankName, accountName, bankCode }: BankDetails) {
    try {
      logger.info(
        `Starting dual verification for account: ${accountNumber}, bank: ${bankName}, account name: ${accountName}`
      );

      // Step 1: Verify with Paycrest API (primary verification)
      const paycrestPayload = {
        accountIdentifier: accountNumber,
        bankName,
        ...(bankCode && { institution: bankCode }) // Use Paycrest bank code if available
      };

      logger.info(
        `Verifying account with Paycrest: ${JSON.stringify(paycrestPayload)}`
      );

      const paycrestResponse = await paycrest.post(`/verify-account`, paycrestPayload);

      if (!(paycrestResponse.status === 200 && paycrestResponse.data.status === "success")) {
        logger.error(
          `Paycrest verification failed: ${paycrestResponse.data.message || "Unknown error"}`
        );
        throw new Error(
          `Account verification failed: ${paycrestResponse.data.message || "Unknown error"}`
        );
      }

      const paycrestAccount = paycrestResponse.data.data;
      logger.info(
        `Paycrest verification successful: ${JSON.stringify(paycrestAccount)}`
      );

      // Always fetch Paystack banks to find the correct Paystack bank code
      // Note: The bankCode from payload is from Paycrest, which is different from Paystack's bank codes
      logger.info(`Fetching Paystack banks to find correct bank code for: ${bankName}`);

      const banksResponse = await paystack.get("/bank");

      if (!(banksResponse.status === 200 && banksResponse.data.status)) {
        logger.warn("Failed to fetch banks from Paystack, continuing with Paycrest verification only");
        return {
          success: true,
          data: {
            accountNumber: paycrestAccount.accountNumber || accountNumber,
            accountName: paycrestAccount.accountName || accountName,
            bankName: paycrestAccount.bankName || bankName,
            verified: true
          },
        };
      }

      const banks: PaystackBank[] = banksResponse.data.data;

      // Find bank by name (case-insensitive partial match)
      const matchingBank = banks.find(bank =>
        bank.name.toLowerCase().includes(bankName.toLowerCase()) ||
        bankName.toLowerCase().includes(bank.name.toLowerCase())
      );

      if (!matchingBank) {
        logger.warn(`No matching bank found in Paystack for: ${bankName}`);
        return {
          success: true,
          data: {
            accountNumber: paycrestAccount.accountNumber || accountNumber,
            accountName: paycrestAccount.accountName || accountName,
            bankName: paycrestAccount.bankName || bankName,
            verified: true
          },
        };
      }

      const paystackBankCode = matchingBank.code;
      logger.info(`Found matching Paystack bank code: ${paystackBankCode} for bank: ${matchingBank.name}`);

      // Verify with Paystack API for account name validation
      logger.info(
        `Verifying account with Paystack: account_number=${accountNumber}, bank_code=${paystackBankCode}`
      );

      const paystackResponse = await paystack.get(`/bank/resolve`, {
        params: {
          account_number: accountNumber,
          bank_code: paystackBankCode,
        },

      });

      if (paystackResponse.status === 200 && paystackResponse.data.status) {
        const paystackAccount = paystackResponse.data.data;
        logger.info(
          `Paystack verification successful: ${JSON.stringify(paystackAccount)}`
        );

        // Step 4: Compare account names
        const providedAccountName = accountName.trim().toLowerCase();
        const paystackAccountName = paystackAccount.account_name.trim().toLowerCase();

        // Normalize names for comparison (remove extra spaces, special characters)
        const normalizeAccountName = (name: string) => {
          return name
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim()
            .toLowerCase();
        };

        const normalizedProvided = normalizeAccountName(providedAccountName);
        const normalizedPaystack = normalizeAccountName(paystackAccountName);

        // Check if names match (exact or partial match)
        const namesMatch = normalizedProvided === normalizedPaystack ||
          normalizedProvided.includes(normalizedPaystack) ||
          normalizedPaystack.includes(normalizedProvided) ||
          this.fuzzyNameMatch(normalizedProvided, normalizedPaystack);

        if (namesMatch) {
          logger.info(
            `Account name verification successful. Provided: "${accountName}", Paystack: "${paystackAccount.account_name}"`
          );

          return {
            success: true,
            data: {
              accountNumber: paystackAccount.account_number,
              accountName: paystackAccount.account_name, // Use Paystack's verified name
              bankName: bankName,
              verified: true
            },
          };
        } else {
          logger.error(
            `Account name mismatch. Provided: "${accountName}", Paystack: "${paystackAccount.account_name}"`
          );

          return {
            success: false,
            message: `Account name mismatch. Expected: "${paystackAccount.account_name}", but got: "${accountName}"`,
            data: {
              accountNumber: paystackAccount.account_number,
              expectedAccountName: paystackAccount.account_name,
              providedAccountName: accountName,
              bankName: bankName,
              verified: false
            },
          };
        }
      } else {
        logger.warn(
          `Paystack verification failed: ${paystackResponse.data.message || "Unknown error"}, continuing with Paycrest verification only`
        );

        // Return success with Paycrest verification only
        return {
          success: true,
          data: {
            accountNumber: paycrestAccount.accountNumber || accountNumber,
            accountName: paycrestAccount.accountName || accountName,
            bankName: paycrestAccount.bankName || bankName,
            verified: true
          },
        };
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

  // Helper method for fuzzy name matching
  private static fuzzyNameMatch(name1: string, name2: string): boolean {
    const words1 = name1.split(' ').filter(word => word.length > 2); // Ignore short words
    const words2 = name2.split(' ').filter(word => word.length > 2);

    // Check if at least 70% of words from each name appear in the other
    const matches1 = words1.filter(word =>
      words2.some(w => w.includes(word) || word.includes(w))
    );
    const matches2 = words2.filter(word =>
      words1.some(w => w.includes(word) || word.includes(w))
    );

    const matchRatio1 = matches1.length / words1.length;
    const matchRatio2 = matches2.length / words2.length;

    return matchRatio1 >= 0.7 && matchRatio2 >= 0.7;
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
