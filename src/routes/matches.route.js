import { Router } from "express";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import {
  createMatchSchema,
  formatValidationErrors,
} from "../validation/matches.js";

export const matchesRouter = Router();

// GET: Fetch all matches (Limit 50)
matchesRouter.get("/", async (req, res) => {
  try {
    const allMatches = await db.select().from(matches).limit(50);

    return res.status(200).json({
      message: "Matches fetched successfully",
      count: allMatches.length,
      data: allMatches,
    });
  } catch (error) {
    console.error("Failed to fetch matches:", error);

    return res.status(500).json({
      message: "Failed to fetch matches",
    });
  }
});

// POST: Create a match
matchesRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: formatValidationErrors(parsed.error),
    });
  }

  const matchData = parsed.data;

  try {
    const [createdMatch] = await db
      .insert(matches)
      .values(matchData)
      .returning();

      if(res.app.locals.broadcastMatchCreated){
        res.app.locals.broadcastMatchCreated(createdMatch); 
      }

    return res.status(201).json({
      message: "Match created successfully",
      data: createdMatch,
    });
  } catch (error) {
    console.error("Failed to create match:", error);

    return res.status(500).json({
      message: "Failed to create match",
    });
  }
});
