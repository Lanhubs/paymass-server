import crypto from "crypto";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { firebaseAdmin } from "../utils/firebase";
const prisma = new PrismaClient();
export const transactionStatusTracker = async (req: Request, res: Response) => {
  try {
    // Step 1: Verify the webhook signature
    const signature = req.get("x-paycrest-signature");
    const payload = JSON.stringify(req.body);

    const hmac = crypto.createHmac(
      "sha256",
      process.env.PAYCREST_WEBHOOK_SECRET ?? ""
    );
    const expectedSignature = hmac.update(payload).digest("hex");

    if (signature !== expectedSignature) {
      console.error("Webhook signature verification failed!");
      return res.status(403).send("Invalid signature");
    }

    // Step 2: Handle the webhook event
    const event = req.body as any;
    const { orderId, status } = event.data;

    // Update the status of the order in the database via Prisma
    const updatedOrder = await prisma.transaction.update({
      where: {
        id: orderId,
      },
      data: {
        status: status,
        updatedAt: new Date(),
      },
    });
    console.log(
      `Database updated for order ${updatedOrder.id} with status: ${status}`
    );

    // Check for a validated status, which confirms the off-ramp succeeded
    if (status === "validated") {
      console.log(
        `🎉 Order ${orderId} has been successfully validated and settled!`
      );
    }
    const user = await prisma.user.findUnique({
      where: {
        id: updatedOrder.userId,
      },
    });
    const userToken = user?.firebaseToken;
    if (user && userToken) {
      const message = {
        notification: {
          title: "Order Completed",
          body: `Your withdrawal order ${orderId} has been successfully completed! Your funds are on their way to your bank account.`,
        },
        token: userToken,
      };

      try {
        const response = await firebaseAdmin.messaging().send(message);
        console.log("Successfully sent Firebase notification:", response);
      } catch (notificationError) {
        console.error(
          "Error sending Firebase notification:",
          notificationError
        );
      }
    }

    // Acknowledge the webhook
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Error handling webhook:", error.message);
    res.status(500).send("Internal Server Error");
  }
};
