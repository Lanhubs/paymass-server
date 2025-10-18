import { PrismaClient } from "@prisma/client";
import { EncryptionService } from "../utils/encryption";
import { logger } from "../utils/logger";
import { PublicKey } from "@solana/web3.js";
import { blockradar } from "../utils/apis";
import { randomBytes, randomUUID, type UUID } from "crypto";
import axios from "axios";

const prisma = new PrismaClient();

export interface WalletData {
  address: string;
  privateKey: string;
  publicKey: string;
  currency: string;
  assetId?: string;
}

export interface transferAssetPayload {
  userId: string;
  assetId: string;
  toAddress: string;
  amount: number;
  currency: string;
  accountName: string;
  accountNumber: string;
  institution: string;
  description?: string;
}
export class WalletService {
  static isValidBaseAddress(address: string): boolean {
    try {
      const publicKey = new PublicKey(address);
      return PublicKey.isOnCurve(publicKey.toBytes());
    } catch {
      return false;
    }
  }

  static async getUserWallets(userId: string) {
    try {
      const wallets = await prisma.wallet.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          currency: true,
          address: true,
          publicKey: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
          assetId: true,
        },
      });

      return wallets;
    } catch (error) {
      logger.error("Failed to get user wallets", { userId, error });
      throw new Error("Failed to retrieve wallets");
    }
  }

  static generateAccountNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    return timestamp + random;
  }

  static async generateWalletAddress(
    userId: string,
    addressName?: string
  ): Promise<{
    address: string;
    privateKey?: string;
    publicKey: string /* currencyImage: string  */;
  }> {
    try {
      // Use the wallet ID from environment variables
      const walletId = process.env.BLOCKRADAR_WALLET_ID ??"";
      if (!walletId) {
        throw new Error("BLOCKRADAR_WALLET_ID not configured");
      }

      logger.info("Attempting to generate wallet address via BlockRadar", {
        userId,
        addressName,
        baseURL: process.env.BLOCKRADAR_BASE_URL,
        hasApiKey: !!process.env.BLOCKRADAR_API_KEY,
        walletId: walletId ? `${walletId.substring(0, 8)}...` : 'NOT_SET'
      });

      const response = await blockradar.post(`/wallets/${walletId}/addresses`, {
        name: addressName || `wallet_${userId}_${Date.now()}`,
        metadata: {
          userId: userId,
          createdAt: new Date().toISOString(),
        },
        showPrivateKey: true,
        disableAutoSweep: false,
        enableGaslessWithdraw: true,
        isEvmCompatible: true,
      });

      logger.info("BlockRadar API response received", {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });

      if (response.status === 200) {
        const walletData = response.data.data;
        logger.info("BlockRadar Base wallet generated successfully", {
          address: walletData.address ? walletData.address.substring(0, 8) + "..." : "NO_ADDRESS",
          userId,
          hasPrivateKey: !!walletData.privateKey,
          hasPublicKey: !!walletData.publicKey,
          walletDataKeys: Object.keys(walletData)
        });

        if (!walletData.address) {
          throw new Error("No address returned from BlockRadar API");
        }

        return {
          address: walletData.address,
          privateKey: walletData.privateKey,
          publicKey: walletData.publicKey || walletData.address,
          // currencyImage:  walletData.blockchain.logoUrl
        };
      } else {
        throw new Error(
          `BlockRadar API error: ${
            response.data.message || "Failed to generate address"
          }`
        );
      }
    } catch (error: any) {
      logger.error("Failed to generate wallet address from BlockRadar API", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        statusCode: error.response?.status,
        responseData: error.response?.data,
        errorDetails: error instanceof Error ? error.stack : undefined
      });
      
      if (error.response?.status === 404) {
        throw new Error("BlockRadar API endpoint not found - check wallet ID and API configuration");
      } else if (error.response?.status === 401) {
        throw new Error("BlockRadar API authentication failed - check API key");
      } else if (error.response?.status === 403) {
        throw new Error("BlockRadar API access forbidden - check permissions");
      } else {
        throw new Error(`BlockRadar API error: ${error.response?.status || 'Network error'} - wallet generation failed`);
      }
    }
  }

  static async createUserWalletsWithBlockRadar(userId: string): Promise<void> {
    try {
      logger.info("Starting wallet creation process", { userId });

      let blockRadarWallet;
      try {
        blockRadarWallet = await this.generateWalletAddress(
          userId,
          `Base_wallet_${userId}`
        );
      } catch (apiError) {
        // If BlockRadar API fails, create a fallback wallet for development
        logger.warn("BlockRadar API failed, using fallback wallet generation", {
          userId,
          error: apiError instanceof Error ? apiError.message : apiError
        });
        
        blockRadarWallet = this.generateFallbackWallet(userId);
      }

      logger.info("Wallet address generated, proceeding with encryption", {
        userId,
        hasAddress: !!blockRadarWallet.address,
        hasPrivateKey: !!blockRadarWallet.privateKey,
        address: blockRadarWallet.address ? blockRadarWallet.address.substring(0, 8) + "..." : "NO_ADDRESS"
      });

      const encryptedPrivateKey = blockRadarWallet.privateKey
        ? EncryptionService.encrypt(blockRadarWallet.privateKey)
        : null;

      if (!encryptedPrivateKey) {
        throw new Error("No private key available for wallet creation");
      }

      logger.info("Private key encrypted, creating wallet records", { userId });

      const walletData = [
        {
          assetId: process.env.ASSET_ID_SOL ?? "",
          userId,
          currency: "Base",
          address: blockRadarWallet.address,
          privateKey: encryptedPrivateKey,
          publicKey: blockRadarWallet.publicKey,
        },
        {
          assetId: process.env.ASSET_ID_USDT ?? "",
          userId,
          currency: "USDT",
          address: blockRadarWallet.address,
          privateKey: encryptedPrivateKey,
          publicKey: blockRadarWallet.publicKey,
        },
        {
          assetId: process.env.ASSET_ID_USDC ?? "",
          userId,
          currency: "USDC",
          address: blockRadarWallet.address,
          privateKey: encryptedPrivateKey,
          publicKey: blockRadarWallet.publicKey,
        }
      ];

      logger.info("Wallet data prepared, executing database transaction", {
        userId,
        walletCount: walletData.length,
        currencies: walletData.map(w => w.currency)
      });

      await prisma.$transaction([
        prisma.wallet.create({ data: walletData[0] }),
        prisma.wallet.create({ data: walletData[1] }),
        prisma.wallet.create({ data: walletData[2] }),
      ]);

      logger.info("Wallets created successfully", {
        userId,
        address: blockRadarWallet.address.substring(0, 8) + "...",
        currencies: ["Base", "USDT", "USDC"],
      });

      // Verify wallets were created
      const createdWallets = await prisma.wallet.findMany({
        where: { userId },
        select: { id: true, currency: true, address: true }
      });

      logger.info("Wallet creation verification", {
        userId,
        expectedCount: 3,
        actualCount: createdWallets.length,
        wallets: createdWallets.map(w => ({
          currency: w.currency,
          hasAddress: !!w.address,
          address: w.address ? w.address.substring(0, 8) + "..." : "NO_ADDRESS"
        }))
      });

    } catch (error) {
      logger.error("Failed to create user wallets", {
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error("Wallet creation failed");
    }
  }

  // Fallback wallet generation for development when BlockRadar API is unavailable
  static generateFallbackWallet(userId: string): {
    address: string;
    privateKey: string;
    publicKey: string;
  } {
    // Generate a mock Base-compatible address for development
    const mockAddress = `0x${randomBytes(20).toString('hex')}`;
    const mockPrivateKey = randomBytes(32).toString('hex');
    const mockPublicKey = randomBytes(33).toString('hex');

    logger.warn("Generated fallback wallet for development", {
      userId,
      address: mockAddress.substring(0, 8) + "...",
      note: "This is a mock wallet for development purposes only"
    });

    return {
      address: mockAddress,
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey
    };
  }

  static async withdrawFunds(
    userId: string,
    assetId: string,
    toAddress: string,
    amount: number,
    currency: string
  ): Promise<{ success: boolean; transactionId?: string; message: string }> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId,
          assetId,
          currency,
          isActive: true,
        },
      });

      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }

      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }
      console.log(wallet.address);

      const response = await axios.post(
        `https://api.blockradar.co/v1/wallets/${
          "20ea5851-9fba-4e0e-8f7d-7792d9ba0541" as UUID
        }/addresses/${wallet.address}/withdraw`,
        {
          assets: [
            {
              assetId: assetId,
              amount: amount.toString(),
              address: toAddress,
            },
          ],
        },
        {
          headers: {
            "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || 201) {
        const responseData = response.data;

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        await prisma.transaction.create({
          data: {
            userId,
            senderWalletId: wallet.id,
            type: "WITHDRAWAL",
            status: "PROCESSING",
            currency,
            amount,
            fee: responseData.fee || 0,
            externalAddress: toAddress,
            externalTxHash: responseData.txHash || responseData.transactionHash,
            description: `Withdraw ${amount} ${currency} to ${toAddress}`,
          },
        });

        logger.info("Withdrawal initiated successfully", {
          userId,
          assetId,
          amount,
          currency,
          txHash: responseData.txHash || responseData.transactionHash,
        });

        return {
          success: true,
          transactionId: responseData.txHash || responseData.transactionHash,
          message: "Withdrawal initiated successfully",
        };
      } else {
        throw new Error(response.data?.message || "Withdrawal failed");
      }
    } catch (error) {
      logger.error("Withdrawal failed", {
        userId,
        assetId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw {
        success: false,
        message: error instanceof Error ? error.message : "Withdrawal failed",
      };
    }
  }

  static async transferAsset({
    userId,
    assetId,
    toAddress,
    amount,
    currency,
    accountName,
    accountNumber,
    institution,
    description

  }: transferAssetPayload): Promise<{
    success: boolean;
    transactionId?: string;
    message: string;
  }> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId,
          assetId,
          currency,
          isActive: true,
        },
      });

      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }

      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }

      const response = await blockradar.post(
        `/addresses/${wallet.address}/withdraw`,
        {
          assets: [
            {
              assetId: assetId,
              amount: amount.toString(),
              address: toAddress,
            },
          ],
        }
      );

      if (response.status === 200 || 201) {
        const responseData = response.data;

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        await prisma.transaction.create({
          data: {
            userId,
            senderWalletId: wallet.id,
            type: "WITHDRAWAL",
            status: "PROCESSING",
            currency,
            amount,
            fee: responseData.fee || 0,
            externalAddress: toAddress,
            externalTxHash: responseData.txHash || responseData.transactionHash,
            description: description || `Transfer ${amount} ${currency} to ${toAddress}`,
            accountName,
            accountNumber,
            bankName: institution,
          },
        });

        logger.info("Withdrawal initiated successfully", {
          userId,
          assetId,
          amount,
          currency,
          txHash: responseData.txHash || responseData.transactionHash,
        });

        return {
          success: true,
          transactionId: responseData.txHash || responseData.transactionHash,
          message: "Withdrawal initiated successfully",
        };
      } else {
        throw new Error(response.data?.message || "Withdrawal failed");
      }
    } catch (error) {
      logger.error("Withdrawal failed", {
        userId,
        assetId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw {
        success: false,
        message: error instanceof Error ? error.message : "Withdrawal failed",
      };
    }
  }

  static async getWalletPrivateKey(
    walletId: string,
    userId: string
  ): Promise<string> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId, isActive: true },
        select: { privateKey: true },
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      return EncryptionService.decrypt(wallet.privateKey);
    } catch (error) {
      logger.error("Failed to get wallet private key", {
        walletId,
        userId,
        error,
      });
      throw new Error("Failed to retrieve private key");
    }
  }

  static async getAssetBalance({
    assetId,
    addressId,
  }: {
    assetId: UUID | string;
    addressId: string;
  }): Promise<any> {
    try {
      const response = await blockradar.get(
        `/addresses/${addressId}/balance?assetId=${assetId}`
      );
      if (response.status === 200) {
        logger.info("Assets retrieved successfully from BlockRadar");
        return response.data.data || {};
      } else {
        throw new Error("Failed to retrieve assets from BlockRadar");
      }
    } catch (error: any) {
      logger.error("Failed to get assets from BlockRadar", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to retrieve assets");
    }
  }

  static async getAssetsBalances({
    addressId,
  }: {
    addressId: string;
  }): Promise<any[]> {
    try {
      const response = await blockradar.get(`/addresses/${addressId}/balances`);

      if (response.status === 200) {
        logger.info("Assets retrieved successfully from BlockRadar");
        return response.data.data || [];
      } else {
        throw new Error("Failed to retrieve assets from BlockRadar");
      }
    } catch (error) {
      logger.error("Failed to get assets from BlockRadar", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to retrieve assets");
    }
  }

  static async getWithdrawalNetworkFee({
    assetId,
    amount,
    address,
  }: {
    assetId: string;
    amount: number;
    address: string;
  }): Promise<any> {
    try {
      const response = await blockradar.get("/withdrawal/network-fee", {
        params: {
          assetId,
          amount: amount.toString(),
          address,
        },
      });

      if (response.status === 200) {
        logger.info(
          "Withdrawal network fee retrieved successfully from BlockRadar",
          {
            assetId,
            amount,
            fee: response.data.data?.fee,
          }
        );
        return response.data.data || {};
      } else {
        throw new Error(
          "Failed to retrieve withdrawal network fee from BlockRadar"
        );
      }
    } catch (error) {
      logger.error("Failed to get withdrawal network fee from BlockRadar", {
        assetId,
        amount,
        address,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to retrieve withdrawal network fee");
    }
  }

  static async executeSwap({
    addressId,
    inputAssetId,
    outputAssetId,
    inputAmount,
    slippage = 1.0,
    recipientAddress,
  }: {
    addressId: string;
    inputAssetId: string;
    outputAssetId: string;
    inputAmount: number;
    slippage?: number;
    recipientAddress: string;
  }): Promise<any> {
    try {
      const response = await blockradar.post(`/addresses/${addressId}/swap`, {
        inputAssetId,
        outputAssetId,
        recipientAddress,
        reference: randomUUID() as string,
        inputAmount: inputAmount.toString(),
      });

      if (response.status === 200) {
        logger.info("Swap executed successfully via BlockRadar", {
          addressId: addressId.substring(0, 8) + "...",
          inputAssetId,
          outputAssetId,
          inputAmount,
          slippage,
          txHash:
            response.data.data?.txHash || response.data.data?.transactionHash,
        });
        return response.data.data || {};
      } else {
        throw new Error(
          response.data?.message || "Failed to execute swap via BlockRadar"
        );
      }
    } catch (error) {
      logger.error("Failed to execute swap via BlockRadar", {
        addressId: addressId.substring(0, 8) + "...",
        inputAssetId,
        outputAssetId,
        inputAmount,
        slippage,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        error instanceof Error ? error.message : "Failed to execute swap"
      );
    }
  }

  static async getSwapDetails({
    amount,
    fromAssetId,
    recipientAddress,
    toAssetId,
    userId,
  }: {
    fromAssetId: UUID | string;
    toAssetId: UUID | string;
    amount: number;
    userId: UUID;
    recipientAddress: string;
  }): Promise<any> {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId,
          isActive: true,
        },
        select: {
          address: true,
        },
      });
      const response = await blockradar.post(
        `/addresses/${wallet?.address as string}/swaps/quote`,
        {
          amount,
          fromAssetId,
          recipientAddress,
          toAssetId,
          order: "Cheapest",
        }
      );
      if (response.status !== 200) {
        throw new Error(response.data.message || "unable to fetch swap quote");
      }
      return response.data.data;
    } catch (error: any) {
      logger.error(error.message);
      throw new Error(error.message || "network error  ");
    }
  }
}
