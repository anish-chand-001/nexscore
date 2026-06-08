import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

/* =========================
   MATCHES
========================= */

export const matchStatusEnum = pgEnum("match_status", [
  "UPCOMING",
  "LIVE",
  "SCHEDULED",
  "FINISHED",
]);

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),

  sport: varchar("sport", { length: 100 }).notNull(),

  homeTeam: varchar("home_team", { length: 100 }).notNull(),

  awayTeam: varchar("away_team", { length: 100 }).notNull(),

  homeScore: integer("home_score").default(0),

  awayScore: integer("away_score").default(0),

  status: matchStatusEnum("status").default("LIVE").notNull(),

  startTime: timestamp("start_time").notNull(),

  endTime: timestamp("end_time").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* =========================
   LIVE COMMENTARY
========================= */

export const commentary = pgTable("commentary", {
  id: serial("id").primaryKey(),

  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id),

  minute: integer("minute").notNull(),

  sequence: integer("sequence").notNull(),

  eventType: varchar("event_type", { length: 50 }).notNull(),

  actor: varchar("actor", { length: 150 }),

  team: varchar("team", { length: 100 }),

  message: text("message").notNull(),

  metadata: text("metadata"),

  tags: text("tags").array(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
