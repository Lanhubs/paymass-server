import { PrismaClient } from "@prisma/client";
import { EncryptionService } from "../../utils/encryption";
import { sign } from "jsonwebtoken";
import { AuthService } from "../authService";

const prisma = new PrismaClient();
interface AUthPayload {
  email: string;
  password: string;
}
export const AdminAuthService = {
  async login({ email, password }: AUthPayload) {
    const user = await prisma.admin.findUnique({
      where: { email },
    });

    if (
      !user ||
      !EncryptionService.verifyPassword(password, user.password)
    ) {
      throw new Error("Invalid credentials");
    }

    const token = sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });

    const data = await AuthService.generateTokens(user.id, user.email);
    return data;
  },
  async register({ email, password }: AUthPayload) {
    const user = await prisma.admin.create({
      data: {
        email,
        password: EncryptionService.hashPassword(password),
        username: "paymass-admin",
      },
    });

    if (user) {
      console.log("admin data stored in the database");
    }
  },
  async getAdmin(id: string) {
    const admin = await prisma.admin.findUnique({
      where: { id: id },
    });
    return admin;
  },
};
