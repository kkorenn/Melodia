const path = require("path");
const { PrismaClient } = require("@prisma/client");

let prisma = null;
let prismaDbPath = "";

function toSqliteFileUrl(dbPath) {
  const resolved = path.resolve(dbPath).replace(/\\/g, "/");
  return `file:${resolved}`;
}

function getPrisma(dbPath) {
  const resolved = path.resolve(dbPath);
  if (prisma && prismaDbPath === resolved) {
    return prisma;
  }

  if (prisma && prismaDbPath !== resolved) {
    prisma.$disconnect().catch(() => {
      // no-op
    });
  }

  prismaDbPath = resolved;
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: toSqliteFileUrl(resolved)
      }
    }
  });

  return prisma;
}

module.exports = {
  getPrisma
};
