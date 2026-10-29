import { openDB, type IDBPDatabase } from "idb";
import { decodeSession, envelope, type Session } from "../session/model";
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
      return value === undefined
        ? { kind: "empty" as const }
        : decodeSession(value);
    },
    async save(session: Session) {
      await (await db()).put("session", envelope(session), "active");
    },
    async close() {
      if (database) (await database).close();
    },
  };
}
export const sessionStore = createSessionStore();
