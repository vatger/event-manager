import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// URL zur Nextcloud-Datei (download-Link!)
const FILE_URL = process.env.USERDATA_URL || "";

async function fetchFile(url: string): Promise<string> {
  console.log("🌐 Lade Datei von:", url);

  const res = await fetch(url, { redirect: "follow" });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Datei konnte nicht geladen werden`);
  }

  const text = await res.text();
  return text;
}

async function importUsers() {
  console.log("📥 Lade Userdaten aus Nextcloud ...");

  const sql = await fetchFile(FILE_URL);

  // 🔍 Regex: Extrahiere Datensätze aus INSERT INTO `User` VALUES (...)
  const regex =
    /\((\d+),\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'[^']*',\s*'[^']*'\)/g;

  const users: {
    cid: number;
    name: string;
    rating: string;
    role: string;
  }[] = [];

  for (const match of sql.matchAll(regex)) {
    const [, , cidStr, name, rating, role] = match;
    users.push({
      cid: Number(cidStr),
      name,
      rating,
      role,
    });
  }

  if (users.length === 0) {
    console.error("⚠️ Keine gültigen Benutzer-Datensätze gefunden!");
    return;
  }

  console.log(`📊 ${users.length} Benutzer gefunden. Starte Import ...`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const existing = await prisma.user.findUnique({
        where: { cid: user.cid },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            cid: user.cid,
            name: user.name,
            rating: user.rating,
            role: "USER",
          },
        });
        created++;
        console.log(`✅ Neu: ${user.name} (${user.cid})`);
      } else if (
        existing.name.toLowerCase() === "unbekannt" ||
        existing.name.trim() === ""
      ) {
        await prisma.user.update({
          where: { cid: user.cid },
          data: {
            name: user.name,
            rating: user.rating,
            role: "USER",
          },
        });
        updated++;
        console.log(`🔄 Aktualisiert: ${user.name} (${user.cid})`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${user.cid}:`, err);
    }
  }

  console.log(
    `\n✅ Fertig!\nNeu erstellt: ${created}\nAktualisiert: ${updated}\nÜbersprungen: ${skipped}`
  );

  await prisma.$disconnect();
}

importUsers()
  .then(() => console.log("🏁 Import abgeschlossen."))
  .catch((err) => {
    console.error("❌ Fehler beim Import:", err);
    prisma.$disconnect();
  });
