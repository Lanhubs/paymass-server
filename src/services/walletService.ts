import { PrismaClient } from "@prisma/client";
import { EncryptionService } from "../utils/encryption";
import { logger } from "../utils/logger";
import { PublicKey } from "@solana/web3.js";
import { blockradar } from "../utils/apis";
import { randomBytes, randomUUID, type UUID } from "crypto";


const prisma = new PrismaClient();

export interface WalletData {
  address: string;
  privateKey: string;
  publicKey: string;
  currency: string;
  network: string;
  assetId?: string;
}

export interface NetworkConfig {
  walletId: string;
  network: string;
  apiKey: string;
  currencies: string[];
  assetIds: { [currency: string]: string };
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
  // Network configurations with their respective wallet IDs, API keys, and supported currencies
  private static readonly NETWORK_CONFIGS: NetworkConfig[] = [
    {
      walletId: process.env.WALLET_ID_BASE ?? "",
      network: "Base",
      apiKey: process.env.WALLET_BASE_API_KEY ?? "",
      currencies: ["ETH", "USDT", "USDC"],
      assetIds: {
        "ETH": process.env.ASSET_ID_ETH ?? "",
        "USDT": process.env.ASSET_ID_USDT ?? "",
        "USDC": process.env.ASSET_ID_USDC ?? ""
      }
    },
    {
      walletId: process.env.WALLET_ID_ETH ?? "",
      network: "Ethereum",
      apiKey: process.env.WALLET_ETH_API_KEY ?? "",
      currencies: ["ETH", "USDT", "USDC"],
      assetIds: {
        "ETH": process.env.ASSET_ID_ETH ?? "",
        "USDT": process.env.ASSET_ID_USDT ?? "",
        "USDC": process.env.ASSET_ID_USDC ?? ""
      }
    },
    {
      walletId: process.env.WALLET_ID_BINANCE ?? "",
      network: "BNB",
      apiKey: process.env.WALLET_BINANCE_API_KEY ?? "",
      currencies: ["BNB", "USDT", "USDC"],
      assetIds: {
        "BNB": process.env.ASSET_ID_BNB ?? "",
        "USDT": process.env.ASSET_ID_USDT_BNB ?? "",
        "USDC": process.env.ASSET_ID_USDC_BNB ?? ""
      }
    },
    {
      walletId: process.env.SOLANA_WALLET_ID ?? "",
      network: "Solana",
      apiKey: process.env.BLOCKRADAR_API_KEY ?? "", // Using main API key for Solana
      currencies: ["SOL", "USDT", "USDC"],
      assetIds: {
        "SOL": process.env.ASSET_ID_SOL ?? "",
        "USDT": process.env.ASSET_ID_USDT_SOL ?? "",
        "USDC": process.env.ASSET_ID_USDC_SOL ?? ""
      }
    },
    {
      walletId: process.env.WALLET_ID_LISK ?? "",
      network: "Lisk",
      apiKey: process.env.WALLET_LISK_API_KEY ?? "",
      currencies: ["LSK", "USDT", "USDC"],
      assetIds: {
        "LSK": process.env.ASSET_ID_LSK ?? "",
        "USDT": process.env.ASSET_ID_USDT_LSK ?? "",
        "USDC": process.env.ASSET_ID_USDC_LSK ?? ""
      }
    },
    {
      walletId: process.env.WALLET_ID_CELO ?? "",
      network: "Celo",
      apiKey: process.env.WALLET_CELO_API_KEY ?? "",
      currencies: ["CELO", "USDT", "USDC"],
      assetIds: {
        "CELO": process.env.ASSET_ID_CELO ?? "",
        "USDT": process.env.ASSET_ID_USDT_CELO ?? "",
        "USDC": process.env.ASSET_ID_USDC_CELO ?? ""
      }
    }
  ];

  static isValidBaseAddress(address: string): boolean {
    try {
      const publicKey = new PublicKey(address);
      return PublicKey.isOnCurve(publicKey.toBytes());
    } catch {
      return false;
    }
  }

  static getNetworkConfig(network: string): NetworkConfig | undefined {
    return this.NETWORK_CONFIGS.find(config =>
      config.network.toLowerCase() === network.toLowerCase()
    );
  }

  static getAllNetworkConfigs(): NetworkConfig[] {
    const validConfigs = this.NETWORK_CONFIGS.filter(config => config.walletId && config.apiKey);
    logger.info("Available network configurations", {
      totalConfigs: this.NETWORK_CONFIGS.length,
      validConfigs: validConfigs.length,
      networks: validConfigs.map(config => ({
        network: config.network,
        hasWalletId: !!config.walletId,
        hasApiKey: !!config.apiKey,
        currencies: config.currencies,
        assetIds: Object.keys(config.assetIds).map(currency => ({
          currency,
          hasAssetId: !!config.assetIds[currency]
        }))
      }))
    });
    return validConfigs;
  }

  private static async getExchangeRates(): Promise<{ [currency: string]: number }> {
    // Mock exchange rates - in production, integrate with CoinGecko API
    // Example: https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,solana&vs_currencies=usd
    return {
      'ETH': 2500,    // ETH to USD
      'BNB': 300,     // BNB to USD  
      'SOL': 100,     // SOL to USD
      'LSK': 1.5,     // LSK to USD
      'CELO': 0.8,    // CELO to USD
      'USDT': 1,      // USDT to USD
      'USDC': 1,      // USDC to USD
      'Base': 2500,   // Base (ETH) to USD
    };
  }

  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  static async calculatePortfolioWorth(userId: string): Promise<{
    totalWorthUSD: number;
    totalWorthFormatted: string;
    breakdown: {
      currency: string;
      network: string;
      balance: number;
      priceUSD: number;
      valueUSD: number;
      valueFormatted: string;
    }[];
    lastUpdated: string;
  }> {
    try {
      const wallets = await this.getUserWallets(userId);
      const exchangeRates = await this.getExchangeRates();

      const breakdown = wallets.map(wallet => {
        const priceUSD = exchangeRates[wallet.currency] || 0;
        const valueUSD = wallet.balance * priceUSD;
        const roundedValueUSD = Math.round(valueUSD * 100) / 100;

        return {
          currency: wallet.currency,
          network: wallet.network || 'Base',
          balance: wallet.balance,
          priceUSD: priceUSD,
          valueUSD: roundedValueUSD,
          valueFormatted: this.formatCurrency(roundedValueUSD)
        };
      });

      const totalWorthUSD = breakdown.reduce((total, item) => total + item.valueUSD, 0);
      const roundedTotalUSD = Math.round(totalWorthUSD * 100) / 100;

      return {
        totalWorthUSD: roundedTotalUSD,
        totalWorthFormatted: this.formatCurrency(roundedTotalUSD),
        breakdown,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error("Failed to calculate portfolio worth", { userId, error });
      return {
        totalWorthUSD: 0,
        totalWorthFormatted: this.formatCurrency(0),
        breakdown: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  static getNetworkStats(): {
    totalNetworks: number;
    activeNetworks: number;
    networks: { network: string; walletId: string; currencies: string[] }[]
  } {
    const activeConfigs = this.getAllNetworkConfigs();
    return {
      totalNetworks: this.NETWORK_CONFIGS.length,
      activeNetworks: activeConfigs.length,
      networks: activeConfigs.map(config => ({
        network: config.network,
        walletId: config.walletId.substring(0, 8) + "...",
        currencies: config.currencies
      }))
    };
  }

  // Optimized method to generate a single wallet address for a specific network
  static async generateSingleNetworkWallet(
    userId: string,
    network: string
  ): Promise<{ success: boolean; wallets: any[]; error?: string }> {
    try {
      const networkConfig = this.getNetworkConfig(network);
      if (!networkConfig) {
        return { success: false, wallets: [], error: `Unsupported network: ${network}` };
      }

      logger.info(`🚀 Generating optimized ${network} wallet`, {
        userId,
        network,
        walletId: networkConfig.walletId.substring(0, 8) + "..."
      });

      const blockRadarWallet = await this.generateWalletAddress(
        userId,
        network,
        `${network}_wallet_${userId}_${Date.now()}`
      );

      const encryptedPrivateKey = blockRadarWallet.privateKey
        ? EncryptionService.encrypt(blockRadarWallet.privateKey)
        : null;

      if (!encryptedPrivateKey) {
        return { success: false, wallets: [], error: "No private key generated" };
      }

      const wallets = [];
      for (const currency of networkConfig.currencies) {
        const assetId = networkConfig.assetIds[currency];
        if (assetId) {
          wallets.push({
            assetId,
            userId,
            currency,
            network,
            address: blockRadarWallet.address,
            privateKey: encryptedPrivateKey,
            publicKey: blockRadarWallet.publicKey,
          });
        }
      }

      return { success: true, wallets };

    } catch (error) {
      logger.error(`Failed to generate ${network} wallet`, {
        userId,
        network,
        error: error instanceof Error ? error.message : error
      });
      return {
        success: false,
        wallets: [],
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  static async getUserWallets(userId: string, network?: string) {
    try {
      const whereClause: any = { userId, isActive: true };
      if (network) {
        whereClause.network = network;
      }

      const wallets = await prisma.wallet.findMany({
        where: whereClause,
        select: {
          id: true,
          currency: true,
          network: true,
          address: true,
          publicKey: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
          assetId: true,
        },
        orderBy: [
          { network: 'asc' },
          { currency: 'asc' }
        ]
      });

      return wallets;
    } catch (error) {
      logger.error("Failed to get user wallets", { userId, error });
      throw new Error("Failed to retrieve wallets");
    }
  }

  static async getUserWalletsByNetwork(userId: string): Promise<{ [network: string]: any[] }> {
    try {
      const wallets = await this.getUserWallets(userId);

      // Group wallets by network
      const walletsByNetwork = wallets.reduce((acc: { [key: string]: any[] }, wallet) => {
        const network = wallet.network || 'Base'; // Default to Base for backward compatibility
        if (!acc[network]) {
          acc[network] = [];
        }
        acc[network].push(wallet);
        return acc;
      }, {});

      return walletsByNetwork;
    } catch (error) {
      logger.error("Failed to get user wallets by network", { userId, error });
      throw new Error("Failed to retrieve wallets by network");
    }
  }

  static generateAccountNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    return timestamp + random;
  }
  // generate wallet address
  static async generateWalletAddress(
    userId: string,
    network: string,
    addressName?: string
  ): Promise<{
    address: string;
    privateKey?: string;
    publicKey: string;
    network: string;
  }> {
    try {
      const networkConfig = this.getNetworkConfig(network);
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${network}`);
      }

      const walletId = networkConfig.walletId;

      if (!walletId) {
        throw new Error(`Wallet ID not configured for network: ${network}`);
      }

      const response = await blockradar.post(`/wallets/${walletId}/addresses`, {
        name: addressName || `${network}_wallet_${userId}_${Date.now()}`,
        metadata: {
          userId: userId,
          network: network,
          createdAt: new Date().toISOString(),
        },
        showPrivateKey: true,
        disableAutoSweep: false,
        enableGaslessWithdraw: true,
        isEvmCompatible: network !== "Solana",
      }, {
        headers: {
          "x-api-key": networkConfig.apiKey,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const walletData = response.data.data;
        if (!walletData.address) {
          throw new Error("No address returned from BlockRadar API");
        }

        return {
          address: walletData.address,
          privateKey: walletData.privateKey,
          publicKey: walletData.publicKey || walletData.address,
          network: network,
        };
      } else {
        throw new Error(`BlockRadar API error: ${response.data.message || "Failed to generate address"}`);
      }
    } catch (error: any) {
      logger.error(`Failed to generate ${network} wallet`, { userId, error: error.message });

      if (error.response?.status === 404) {
        throw new Error(`BlockRadar API endpoint not found - check wallet ID for ${network}`);
      } else if (error.response?.status === 401) {
        throw new Error("BlockRadar API authentication failed");
      } else if (error.response?.status === 403) {
        throw new Error("BlockRadar API access forbidden");
      } else {
        throw new Error(`${network} wallet generation failed`);
      }
    }
  }

  static async createUserWalletsWithBlockRadar(userId: string): Promise<void> {
    try {
      logger.info("🚀 Starting wallet creation process", { userId });

      const availableNetworks = this.getAllNetworkConfigs();

      if (availableNetworks.length === 0) {
        logger.error("❌ No valid network configurations found", { userId });
        await this.createFallbackWallets(userId);
        return;
      }

      logger.info("📋 Available networks for wallet creation", {
        userId,
        networkCount: availableNetworks.length,
        networks: availableNetworks.map(n => n.network)
      });

      const walletDataToCreate: any[] = [];

      const walletGenerationPromises = availableNetworks.map(async (networkConfig) => {
        try {
          logger.info(`🌐 Attempting to generate ${networkConfig.network} wallet`, {
            userId,
            network: networkConfig.network,
            hasWalletId: !!networkConfig.walletId,
            hasApiKey: !!networkConfig.apiKey
          });

          const blockRadarWallet = await this.generateWalletAddress(
            userId,
            networkConfig.network,
            `${networkConfig.network}_wallet_${userId}`
          );

          const encryptedPrivateKey = blockRadarWallet.privateKey
            ? EncryptionService.encrypt(blockRadarWallet.privateKey)
            : null;

          if (!encryptedPrivateKey) {
            logger.warn(`⚠️ No private key for ${networkConfig.network} wallet`, { userId });
            return { success: false, network: networkConfig.network, wallets: [] };
          }

          const networkWallets = [];
          for (const currency of networkConfig.currencies) {
            const assetId = networkConfig.assetIds[currency];
            if (assetId) {
              networkWallets.push({
                assetId,
                userId,
                currency,
                network: networkConfig.network,
                address: blockRadarWallet.address,
                privateKey: encryptedPrivateKey,
                publicKey: blockRadarWallet.publicKey,
              });
            } else {
              logger.warn(`⚠️ No asset ID for ${currency} on ${networkConfig.network}`, {
                userId,
                currency,
                network: networkConfig.network
              });
            }
          }

          logger.info(`✅ Successfully generated ${networkConfig.network} wallet`, {
            userId,
            network: networkConfig.network,
            address: blockRadarWallet.address.substring(0, 8) + "...",
            walletsCreated: networkWallets.length
          });

          return { success: true, network: networkConfig.network, wallets: networkWallets };

        } catch (networkError) {
          logger.error(`❌ Failed to generate ${networkConfig.network} wallet`, {
            userId,
            network: networkConfig.network,
            error: networkError instanceof Error ? networkError.message : networkError
          });

          // For critical networks, try fallback
          if (networkConfig.network === "Base" || networkConfig.network === "Ethereum") {
            logger.info(`🔄 Using fallback wallet for ${networkConfig.network}`, { userId });

            const fallbackWallet = this.generateFallbackWallet(userId, networkConfig.network);
            const encryptedPrivateKey = EncryptionService.encrypt(fallbackWallet.privateKey);

            const fallbackWallets = [];
            for (const currency of networkConfig.currencies) {
              const assetId = networkConfig.assetIds[currency];
              if (assetId) {
                fallbackWallets.push({
                  assetId,
                  userId,
                  currency,
                  network: networkConfig.network,
                  address: fallbackWallet.address,
                  privateKey: encryptedPrivateKey,
                  publicKey: fallbackWallet.publicKey,
                });
              }
            }
            return { success: true, network: networkConfig.network, wallets: fallbackWallets, isFallback: true };
          }

          return { success: false, network: networkConfig.network, wallets: [] };
        }
      });

      const walletResults = await Promise.allSettled(walletGenerationPromises);

      walletResults.forEach((result, index) => {
        const networkName = availableNetworks[index].network;

        if (result.status === 'fulfilled') {
          if (result.value.success) {
            walletDataToCreate.push(...result.value.wallets);
            logger.info(`✅ ${networkName} wallet processing completed`, {
              userId,
              network: networkName,
              walletsAdded: result.value.wallets.length
            });
          } else {
            logger.error(`❌ ${networkName} wallet processing failed`, {
              userId,
              network: networkName
            });
          }
        } else {
          logger.error(`❌ ${networkName} wallet promise rejected`, {
            userId,
            network: networkName,
            error: result.reason
          });
        }
      });

      if (walletDataToCreate.length === 0) {
        logger.error("❌ No wallets could be generated for any network, creating fallback wallets", { userId });
        await this.createFallbackWallets(userId);
        return;
      }

      logger.info("💾 Creating wallet records in database", {
        userId,
        totalWallets: walletDataToCreate.length,
        networks: [...new Set(walletDataToCreate.map(w => w.network))],
        currencies: [...new Set(walletDataToCreate.map(w => w.currency))]
      });

      await prisma.$transaction(
        walletDataToCreate.map(walletData =>
          prisma.wallet.create({ data: walletData })
        )
      );

      logger.info("🎉 Multi-network wallets created successfully", {
        userId,
        walletCount: walletDataToCreate.length,
        networks: [...new Set(walletDataToCreate.map(w => w.network))]
      });

    } catch (error) {
      logger.error("❌ Failed to create user wallets", {
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Try to create fallback wallets as last resort
      try {
        logger.info("🔄 Attempting to create fallback wallets as last resort", { userId });
        await this.createFallbackWallets(userId);
      } catch (fallbackError) {
        logger.error("❌ Failed to create fallback wallets", {
          userId,
          error: fallbackError instanceof Error ? fallbackError.message : fallbackError
        });
        throw new Error("Complete wallet creation failure - no wallets could be created");
      }
    }
  }

  static generateFallbackWallet(userId: string, network: string = "Base"): {
    address: string;
    privateKey: string;
    publicKey: string;
    network: string;
  } {
    let mockAddress: string;

    if (network === "Solana") {
      mockAddress = randomBytes(32).toString('base64').replace(/[+/=]/g, '').substring(0, 44);
    } else {
      mockAddress = `0x${randomBytes(20).toString('hex')}`;
    }

    const mockPrivateKey = randomBytes(32).toString('hex');
    const mockPublicKey = randomBytes(33).toString('hex');

    return {
      address: mockAddress,
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      network: network
    };
  }

  static async createFallbackWallets(userId: string): Promise<void> {
    try {

      const fallbackWallets = [];
      const criticalNetworks = ["Base", "Ethereum"];

      for (const network of criticalNetworks) {
        const fallbackWallet = this.generateFallbackWallet(userId, network);
        const encryptedPrivateKey = EncryptionService.encrypt(fallbackWallet.privateKey);

        // Create basic wallets for essential currencies
        const currencies = network === "Base" ? ["ETH", "USDT", "USDC"] : ["ETH", "USDT", "USDC"];

        for (const currency of currencies) {
          fallbackWallets.push({
            assetId: `fallback_${network}_${currency}`, // Fallback asset ID
            userId,
            currency,
            network,
            address: fallbackWallet.address,
            privateKey: encryptedPrivateKey,
            publicKey: fallbackWallet.publicKey,
          });
        }
      }

      await prisma.$transaction(
        fallbackWallets.map(walletData =>
          prisma.wallet.create({ data: walletData })
        )
      );

      logger.info("Fallback wallets created successfully", {
        userId,
        walletCount: fallbackWallets.length,
        networks: criticalNetworks
      });

    } catch (error) {
      logger.error("Failed to create fallback wallets", {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  static async withdrawFunds(
    userId: string,
    assetId: string,
    toAddress: string,
    amount: number,
    currency: string,
    network?: string
  ): Promise<{ success: boolean; transactionId?: string; message: string }> {
    try {
      const whereClause: any = {
        userId,
        assetId,
        currency,
        isActive: true,
      };

      if (network) {
        whereClause.network = network;
      }

      const wallet = await prisma.wallet.findFirst({
        where: whereClause,
      });

      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }

      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }

      // Get the appropriate wallet ID for the network
      const networkConfig = this.getNetworkConfig(wallet.network || "Base");
      if (!networkConfig) {
        throw new Error(`Network configuration not found for: ${wallet.network}`);
      }

      const response = await blockradar.post(
        `/wallets/${networkConfig.walletId}/addresses/${wallet.address}/withdraw`,
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
            "x-api-key": networkConfig.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
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
            description: `Withdraw ${amount} ${currency} from ${wallet.network} to ${toAddress}`,
          },
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
        currency,
        network,
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
    description,
    network

  }: transferAssetPayload & { network?: string }): Promise<{
    success: boolean;
    transactionId?: string;
    message: string;
  }> {
    try {
      const whereClause: any = {
        userId,
        assetId,
        currency,
        isActive: true,
      };

      if (network) {
        whereClause.network = network;
      }

      const wallet = await prisma.wallet.findFirst({
        where: whereClause,
      });

      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }

      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }

      // Get the appropriate wallet ID for the network
      const networkConfig = this.getNetworkConfig(wallet.network || "Base");
      if (!networkConfig) {
        throw new Error(`Network configuration not found for: ${wallet.network}`);
      }

      const response = await blockradar.post(
        `/wallets/${networkConfig.walletId}/addresses/${wallet.address}/withdraw`,
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
            "x-api-key": networkConfig.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
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
            description: description || `Transfer ${amount} ${currency} from ${wallet.network} to ${toAddress}`,
            accountName,
            accountNumber,
            bankName: institution,
          },
        });



        return {
          success: true,
          transactionId: responseData.txHash || responseData.transactionHash,
          message: "Transfer initiated successfully",
        };
      } else {
        throw new Error(response.data?.message || "Transfer failed");
      }
    } catch (error) {
      logger.error("Transfer failed", {
        userId,
        assetId,
        currency,
        network,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw {
        success: false,
        message: error instanceof Error ? error.message : "Transfer failed",
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
        `/addresses/${addressId}/balance?assetId=${assetId}`,
        {
          headers: {
            "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
          },
        }
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
      const response = await blockradar.get(`/addresses/${addressId}/balances`, {
        headers: {
          "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
        },
      });

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
        headers: {
          "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
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
      }, {
        headers: {
          "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200) {

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
        },
        {
          headers: {
            "x-api-key": process.env.BLOCKRADAR_API_KEY ?? "",
            "Content-Type": "application/json",
          },
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
