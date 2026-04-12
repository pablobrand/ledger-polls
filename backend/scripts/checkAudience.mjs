import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({
    where: { sessionToken: { not: null } },
    orderBy: { dateLogged: 'desc' },
    select: { sessionToken: true, walletAddress: true },
  });

  if (!user?.sessionToken) {
    console.log(JSON.stringify({ ok: false, reason: 'no_active_session' }, null, 2));
    process.exit(0);
  }

  const response = await fetch('http://localhost:4000/api/audience/summary', {
    headers: { Authorization: `Bearer ${user.sessionToken}` },
  });

  const payload = await response.json().catch(() => null);
  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        walletAddress: user.walletAddress,
        payload,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
