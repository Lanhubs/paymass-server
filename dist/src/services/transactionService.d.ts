import { TransactionStatus, TransactionType } from '@prisma/client';
export interface SendTransactionRequest {
    fromWalletId: string;
    toAddress: string;
    amount: number;
    currency: 'Base' | 'USDT' | 'USDC';
    description?: string;
}
export interface TransactionResponse {
    id: string;
    status: TransactionStatus;
    txHash?: string;
    fee: number;
    estimatedConfirmation?: string;
}
export interface TransactionHistory {
    transactions: any[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export declare class TransactionService {
    private static calculateTransactionFee;
    static processIncomingTransaction(walletAddress: string, fromAddress: string, amount: number, currency: string, txHash: string): Promise<void>;
    static getTransactionHistory(userId: string, page?: number, limit?: number, currency?: string, type?: TransactionType): Promise<TransactionHistory>;
    static getTransactionById(userId: string, transactionId: string): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.TransactionType;
        status: import(".prisma/client").$Enums.TransactionStatus;
        currency: string;
        amount: number;
        fee: number;
        description: string | null;
        externalAddress: string | null;
        externalTxHash: string | null;
        senderWallet: {
            currency: string;
            address: string;
        } | null;
        receiverWallet: {
            currency: string;
            address: string;
        } | null;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        completedAt: Date | null;
    }>;
    static getWalletSummary(userId: string, currency?: string): Promise<{
        balance: number;
        recentTransactions: {
            amount: number;
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.TransactionType;
            status: import(".prisma/client").$Enums.TransactionStatus;
            externalTxHash: string | null;
        }[];
        id: string;
        currency: string;
        address: string;
        updatedAt: Date;
    }[]>;
    static estimateTransactionFee(currency: string, amount: number): number;
}
//# sourceMappingURL=transactionService.d.ts.map