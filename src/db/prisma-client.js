import { env } from '../config/env.js';

let prismaClient = null;

export async function getPrismaClient() {
  if (prismaClient) {
    return prismaClient;
  }

  const { PrismaClient } = await import('@prisma/client');

  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  return prismaClient;
}
