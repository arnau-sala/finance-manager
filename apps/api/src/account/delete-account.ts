import type { Prisma } from "@prisma/client";

export async function deleteUserAccount(
  transaction: Prisma.TransactionClient,
  user: { id: string; email: string },
) {
  await transaction.accessRequest.deleteMany({
    where: { email: user.email },
  });

  await transaction.accessRequestEvent.deleteMany({
    where: { email: user.email },
  });

  await transaction.approvedEmail.deleteMany({
    where: { email: user.email },
  });

  await transaction.accessRequestEvent.updateMany({
    where: { adminId: user.id },
    data: { adminId: null },
  });

  await transaction.approvedEmail.updateMany({
    where: { approvedBy: user.id },
    data: { approvedBy: null },
  });

  const deletion = await transaction.user.deleteMany({
    where: { id: user.id },
  });

  return deletion.count === 1;
}
