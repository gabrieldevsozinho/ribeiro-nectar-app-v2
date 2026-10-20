import { drizzle } from "drizzle-orm/d1";
import * as esquema from "./esquema";

export function criarDb(d1: D1Database) {
  return drizzle(d1, { schema: esquema });
}

export type Db = ReturnType<typeof criarDb>;
