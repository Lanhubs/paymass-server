import { type UUID } from 'crypto';
export interface WalletData {
    address: string;
    privateKey: string;
    publicKey: string;
    currency: string;
    assetId?: string;
}
export declare class WalletService {
    static isValidSolanaAddress(address: string): boolean;
    static getUserWallets(userId: string): Promise<{
        id: string;
        currency: string;
        address: string;
        publicKey: string;
        assetId: string;
        balance: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    static generateAccountNumber(): string;
    static generateWalletAddress(userId: string, addressName?: string): Promise<{
        address: string;
        privateKey?: string;
        publicKey: string;
    }>;
    static createUserWalletsWithBlockRadar(userId: string): Promise<void>;
    static withdrawFunds(userId: string, assetId: string, toAddress: string, amount: number, currency: string): Promise<{
        success: boolean;
        transactionId?: string;
        message: string;
    }>;
    static getWalletPrivateKey(walletId: string, userId: string): Promise<string>;
    static getAssetBalance({ assetId, addressId, }: {
        assetId: UUID | string;
        addressId: string;
    }): Promise<any>;
    static getAssetsBalances({ addressId }: {
        addressId: string;
    }): Promise<any[]>;
    static getWithdrawalNetworkFee({ assetId, amount, address }: {
        assetId: string;
        amount: number;
        address: string;
    }): Promise<any>;
    static executeSwap({ addressId, inputAssetId, outputAssetId, inputAmount, slippage, recipientAddress }: {
        addressId: string;
        inputAssetId: string;
        outputAssetId: string;
        inputAmount: number;
        slippage?: number;
        recipientAddress: string;
    }): Promise<any>;
    static getSwapDetails({ amount, fromAssetId, recipientAddress, toAssetId, userId }: {
        fromAssetId: UUID | string;
        toAssetId: UUID | string;
        amount: number;
        userId: UUID;
        recipientAddress: string;
    }): Promise<any>;
}
//# sourceMappingURL=walletService.d.ts.map