# Admin Dashboard API Documentation

Complete API documentation for the "Spend Crypto Like Cash" platform admin dashboard.

## Table of Contents
1. [Authentication](#1-authentication)
2. [Dashboard Overview](#2-dashboard-overview)
3. [User Management](#3-user-management)
4. [KYC & Compliance](#4-kyc--compliance)
5. [Transaction Management](#5-transaction-management)
6. [Revenue & Fees](#6-revenue--fees)
7. [Support & Operations](#7-support--operations)

---

## 1. Authentication

### POST /admin/login
Admin login endpoint.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "admin"
  }
}
```

### GET /admin/profile
Get current admin profile (requires authentication).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@example.com",
  "username": "admin",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## 2. Dashboard Overview

### GET /admin/dashboard/overview
Get high-level business metrics.

**Query Parameters:**
- `period` (optional): `daily` | `weekly` | `monthly` (default: `daily`)

**Response:**
```json
{
  "period": "daily",
  "users": {
    "total": 1500,
    "active": 1200,
    "inactive": 300
  },
  "transactions": {
    "total": 5000,
    "pending": 50,
    "failed": 100,
    "successful": 4850,
    "successRate": "97.00"
  },
  "volume": {
    "totalCrypto": 150000.50,
    "totalFiat": 45000000.00,
    "totalFees": 7500.25
  },
  "topUsers": [
    {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "totalSpent": 50000.00,
      "totalFiatSpent": 15000000.00,
      "transactionCount": 150
    }
  ]
}
```

### GET /admin/dashboard/trends
Get transaction trends over time.

**Query Parameters:**
- `days` (optional): Number of days (default: 30)

**Response:**
```json
[
  {
    "date": "2024-01-01T00:00:00.000Z",
    "count": 150,
    "volume": 5000.00,
    "fiatVolume": 1500000.00,
    "fees": 250.00
  }
]
```

---

## 3. User Management

### GET /admin/users
Get list of users with filters.

**Query Parameters:**
- `search` (optional): Search by email, name, phone, or account number
- `isActive` (optional): `true` | `false`
- `isVerified` (optional): `true` | `false`
- `ninVerified` (optional): `true` | `false`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+2348012345678",
      "accountNumber": "1234567890",
      "isActive": true,
      "isVerified": true,
      "ninVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-15T10:30:00.000Z",
      "_count": {
        "transactions": 50,
        "wallets": 5
      }
    }
  ],
  "pagination": {
    "total": 1500,
    "page": 1,
    "limit": 20,
    "totalPages": 75
  }
}
```

### GET /admin/users/:userId
Get detailed user information.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+2348012345678",
    "accountNumber": "1234567890",
    "isActive": true,
    "isVerified": true,
    "ninVerified": true,
    "wallets": [
      {
        "id": "uuid",
        "currency": "USDT",
        "network": "Base",
        "address": "0x...",
        "balance": 1000.50,
        "isActive": true
      }
    ],
    "transactions": [],
    "verifications": [],
    "sessions": []
  },
  "statistics": {
    "totalTransactions": 50,
    "totalSpent": 5000.00,
    "totalFiatSpent": 1500000.00,
    "totalFees": 250.00,
    "totalBalance": 2500.75
  }
}
```

### POST /admin/users/:userId/freeze
Freeze a user account.

**Request Body:**
```json
{
  "reason": "Suspicious activity detected"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account frozen successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "isActive": false
  }
}
```

### POST /admin/users/:userId/unfreeze
Unfreeze a user account.

**Response:**
```json
{
  "success": true,
  "message": "Account unfrozen successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "isActive": true
  }
}
```

### POST /admin/users/:userId/adjust-balance
Manually adjust user wallet balance.

**Request Body:**
```json
{
  "walletId": "uuid",
  "amount": 100.50,
  "reason": "Compensation for system error"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Balance adjusted successfully",
  "wallet": {
    "id": "uuid",
    "currency": "USDT",
    "balance": 1100.50
  }
}
```

### POST /admin/users/:userId/reset-pin
Reset user transaction PIN.

**Response:**
```json
{
  "success": true,
  "message": "User PIN reset successfully"
}
```

---

## 4. KYC & Compliance

### GET /admin/kyc/pending
Get pending KYC reviews.

**Query Parameters:**
- `status` (optional): `PENDING` | `IN_REVIEW` | `APPROVED` | `REJECTED`
- `type` (optional): `NIN` | `BVN` | `PHONE` | `EMAIL` | `IDENTITY_DOCUMENT`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "verifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "NIN",
      "status": "PENDING",
      "documentUrl": "https://...",
      "submittedAt": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### GET /admin/kyc/:verificationId
Get KYC verification details.

### POST /admin/kyc/:verificationId/approve
Approve KYC verification.

**Response:**
```json
{
  "success": true,
  "message": "KYC approved successfully",
  "verification": {
    "id": "uuid",
    "status": "APPROVED",
    "reviewedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /admin/kyc/:verificationId/reject
Reject KYC verification.

**Request Body:**
```json
{
  "reason": "Document not clear"
}
```

### GET /admin/compliance/high-risk-users
Get list of high-risk users.

**Response:**
```json
[
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "failedTransactions": 10,
    "recentSessions": 15,
    "riskScore": 120
  }
]
```

### GET /admin/compliance/suspicious-patterns
Get users with suspicious spending patterns.

**Response:**
```json
[
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "transactionCount": 25,
    "totalAmount": 50000.00,
    "period": "24h"
  }
]
```

---

## 5. Transaction Management

### GET /admin/transactions
Get all transactions with filters.

**Query Parameters:**
- `status` (optional): `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED` | `CANCELLED`
- `type` (optional): `DEPOSIT` | `WITHDRAWAL` | `SEND` | `RECEIVE` | `SWAP` | `ON_RAMP` | `OFF_RAMP`
- `userId` (optional): Filter by user ID
- `currency` (optional): Filter by currency
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `minAmount` (optional): Minimum amount
- `maxAmount` (optional): Maximum amount
- `search` (optional): Search by transaction ID, hash, or reference
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "WITHDRAWAL",
      "status": "COMPLETED",
      "currency": "USDT",
      "amount": 100.00,
      "fee": 2.50,
      "fiatAmount": 30000.00,
      "fiatCurrency": "NGN",
      "exchangeRate": 300.00,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:05:00.000Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ],
  "pagination": {
    "total": 5000,
    "page": 1,
    "limit": 50,
    "totalPages": 100
  }
}
```

### GET /admin/transactions/:transactionId
Get transaction details.

### POST /admin/transactions/:transactionId/approve
Approve a pending transaction.

**Response:**
```json
{
  "success": true,
  "message": "Transaction approved successfully",
  "transaction": {
    "id": "uuid",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /admin/transactions/:transactionId/cancel
Cancel a pending transaction.

**Request Body:**
```json
{
  "reason": "User request"
}
```

### POST /admin/transactions/:transactionId/reverse
Reverse a completed transaction.

**Request Body:**
```json
{
  "reason": "System error - duplicate charge"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction reversed successfully",
  "originalTransaction": {},
  "reversalTransaction": {}
}
```

### POST /admin/transactions/:transactionId/retry
Retry a failed transaction.

**Response:**
```json
{
  "success": true,
  "message": "Transaction retry initiated",
  "transaction": {
    "id": "uuid",
    "status": "PENDING"
  }
}
```

### GET /admin/transactions/statistics
Get transaction statistics.

**Query Parameters:**
- `period` (optional): `daily` | `weekly` | `monthly` (default: `daily`)

**Response:**
```json
{
  "period": "daily",
  "byStatus": [
    {
      "status": "COMPLETED",
      "_count": 4850,
      "_sum": {
        "amount": 150000.00,
        "fee": 7500.00
      }
    }
  ],
  "byType": [],
  "byCurrency": []
}
```

---

## 6. Revenue & Fees

### GET /admin/revenue/fees
Get fees overview.

**Query Parameters:**
- `period` (optional): `daily` | `weekly` | `monthly` (default: `daily`)

**Response:**
```json
{
  "period": "daily",
  "totalFees": 7500.25,
  "feesByType": [
    {
      "type": "WITHDRAWAL",
      "totalFees": 5000.00,
      "transactionCount": 200
    }
  ]
}
```

### GET /admin/revenue/report
Generate revenue report for date range.

**Query Parameters:**
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response:**
```json
{
  "period": {
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z"
  },
  "summary": {
    "totalTransactions": 5000,
    "totalVolume": 150000.00,
    "totalFees": 7500.00,
    "totalFiatVolume": 45000000.00,
    "byType": {},
    "byCurrency": {}
  },
  "transactions": []
}
```

### GET /admin/revenue/daily
Get daily revenue breakdown.

**Query Parameters:**
- `days` (optional): Number of days (default: 30)

**Response:**
```json
[
  {
    "date": "2024-01-01T00:00:00.000Z",
    "transactionCount": 150,
    "totalVolume": 5000.00,
    "totalFees": 250.00
  }
]
```

### GET /admin/revenue/top-users
Get top revenue-generating users.

**Query Parameters:**
- `limit` (optional): Number of users (default: 10)
- `period` (optional): `daily` | `weekly` | `monthly` (default: `monthly`)

**Response:**
```json
[
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "totalFees": 500.00,
    "totalVolume": 10000.00,
    "transactionCount": 50
  }
]
```

---

## 7. Support & Operations

### POST /admin/support/lookup
Look up transactions by various criteria.

**Request Body:**
```json
{
  "transactionId": "uuid",
  "email": "user@example.com",
  "phoneNumber": "+2348012345678",
  "accountNumber": "1234567890"
}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "WITHDRAWAL",
    "status": "COMPLETED",
    "amount": 100.00,
    "user": {},
    "senderWallet": {},
    "receiverWallet": {}
  }
]
```

### POST /admin/support/recredit
Re-credit a user's wallet.

**Request Body:**
```json
{
  "userId": "uuid",
  "walletId": "uuid",
  "amount": 100.00,
  "reason": "Compensation for failed transaction",
  "originalTransactionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User re-credited successfully",
  "wallet": {},
  "transaction": {}
}
```

### GET /admin/support/user-history/:userId
Get user's support history.

**Response:**
```json
{
  "adminTransactions": [],
  "verifications": [],
  "recentSessions": []
}
```

### GET /admin/support/search
Quick user search.

**Query Parameters:**
- `q` (required): Search query

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+2348012345678",
    "accountNumber": "1234567890",
    "isActive": true,
    "isVerified": true
  }
]
```

### GET /admin/support/failed-transactions
Get recent failed transactions.

**Query Parameters:**
- `limit` (optional): Number of transactions (default: 50)

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "WITHDRAWAL",
    "status": "FAILED",
    "amount": 100.00,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "user": {},
    "senderWallet": {}
  }
]
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `401` - Unauthorized (invalid or missing token)
- `404` - Resource not found
- `500` - Internal server error

---

## Authentication

All admin endpoints (except `/admin/login`) require authentication using JWT tokens.

**Header Format:**
```
Authorization: Bearer {accessToken}
```

Tokens are obtained from the `/admin/login` endpoint and should be included in all subsequent requests.
