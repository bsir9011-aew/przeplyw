import { openDB, type IDBPDatabase } from "idb";
import { decodeSession, envelope, type Workspace } from "../session/model";
export function createSessionStore(name = "przeplyw") {
  let database: Promise<IDBPDatabase> | undefined;
  function db() {
    if (!database)
      database = new Promise<IDBPDatabase>((resolve, reject) => {
        let expired = false;
        const timer = setTimeout(() => {
          expired = true;
          reject(Error("Przekroczono czas otwierania zapisu."));
        }, 3000);
        openDB(name, 1, {
          upgrade(db) {
            db.createObjectStore("session");
          },
          blocking() {
            void database?.then((db) => db.close());
          },
        }).then(
          (db) => {
            clearTimeout(timer);
            if (expired) db.close();
            else resolve(db);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    return database;
  }
  return {
    async load() {
      const value = await (await db()).get("session", "active");
      if (value === undefined) return { kind: "empty" as const };
      const decoded = decodeSession(value);
      // Preserve the old record before any automatic save can replace active.
      if (decoded.kind !== "restored" || decoded.migrated) {
        const database = await db();
        const tx = database.transaction("session", "readwrite");
        const key =
          decoded.kind === "restored" ? "backup-pr2" : "backup-unrecognized";
        if ((await tx.store.get(key)) === undefined)
          await tx.store.put(value, key);
        await tx.done;
      }
      return decoded;
    },
    async save(session: Workspace) {
      await (await db()).put("session", envelope(session), "active");
    },
    async close() {
      if (database) (await database).close();
    },
  };
}
export const sessionStore = createSessionStore();
