import type { Prisma } from "@prisma/client";

export async function deleteUserAccount(
  transaction: Prisma.TransactionClient,
  user: { id: string; email: string },
) {
  await transaction.pendingRegistration.deleteMany({
    where: { email: user.email },
  });

  const deletion = await transaction.user.deleteMany({
    where: { id: user.id },
  });

  return deletion.count === 1;
}
