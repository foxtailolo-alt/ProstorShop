import { PrismaClient } from "@prisma/client";
export type { Prisma } from "@prisma/client";
export * from "./telegram-login";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}