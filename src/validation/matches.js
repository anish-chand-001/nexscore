import { z } from "zod";
import { MATCH_STATUS, MATCH_STATUS_VALUES } from "../utils/match-status.js";

export const matchStatuses = MATCH_STATUS_VALUES;

const MAX_SCORE = 1_000;
const MIN_DATE = new Date("2000-01-01T00:00:00.000Z");
const MAX_DATE = new Date("2100-01-01T00:00:00.000Z");

const SQL_META_PATTERN = /(--|\/\*|\*\/|;|\0)/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const DECIMAL_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const ISO_LIKE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/;

const fieldLabel = (path) => path.join(".") || "body";

const trimString = (value) =>
  typeof value === "string" ? value.trim() : value;

const requiredTrimmedString = (label, maxLength) =>
  z.preprocess(
    trimString,
    z
      .string({
        error: `${label} is required and must be a string`,
      })
      .min(1, `${label} cannot be empty or whitespace only`)
      .max(maxLength, `${label} must be ${maxLength} characters or fewer`)
      .refine(
        (value) => !CONTROL_CHAR_PATTERN.test(value),
        `${label} cannot contain control characters`,
      )
      .refine(
        (value) => !SQL_META_PATTERN.test(value),
        `${label} contains unsupported SQL control sequences`,
      ),
  );

const scoreSchema = (label) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return DECIMAL_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : value;
    },
    z
      .number({
        error: `${label} must be a number`,
      })
      .finite(`${label} must be a finite number`)
      .int(`${label} must be a whole number`)
      .min(0, `${label} cannot be negative`)
      .max(MAX_SCORE, `${label} is too large`),
  );

const parseDateInput = (value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!ISO_LIKE_DATE_PATTERN.test(trimmed)) {
    return value;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? value : date;
};

const requiredDate = (label) =>
  z.preprocess(
    parseDateInput,
    z
      .date({
        error: `${label} must be a valid ISO date or datetime string`,
      })
      .min(MIN_DATE, `${label} must be on or after 2000-01-01`)
      .max(MAX_DATE, `${label} must be before 2100-01-01`),
  );

const normalizedStatus = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(matchStatuses, {
    error: `Status must be one of: ${matchStatuses.join(", ")}`,
  }),
);

const addMatchConsistencyIssues = (match, ctx) => {
  if (
    match.homeTeam &&
    match.awayTeam &&
    match.homeTeam.toLowerCase() === match.awayTeam.toLowerCase()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["awayTeam"],
      message: "Away team must be different from home team",
    });
  }

  if (match.startTime && match.endTime && match.endTime <= match.startTime) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }

  if (
    match.status === "FINISHED" &&
    match.startTime &&
    match.startTime > new Date()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message: "A future match cannot be marked as finished",
    });
  }
};

export const createMatchSchema = z
  .strictObject({
    sport: requiredTrimmedString("Sport", 100),
    homeTeam: requiredTrimmedString("Home team", 100),
    awayTeam: requiredTrimmedString("Away team", 100),
    homeScore: scoreSchema("Home score").optional().default(0),
    awayScore: scoreSchema("Away score").optional().default(0),
    status: normalizedStatus.optional().default(MATCH_STATUS.SCHEDULED),
    startTime: requiredDate("Start time"),
    endTime: requiredDate("End time"),
  })
  .superRefine(addMatchConsistencyIssues);

export const updateMatchSchema = z
  .strictObject({
    sport: requiredTrimmedString("Sport", 100).optional(),
    homeTeam: requiredTrimmedString("Home team", 100).optional(),
    awayTeam: requiredTrimmedString("Away team", 100).optional(),
    homeScore: scoreSchema("Home score").optional(),
    awayScore: scoreSchema("Away score").optional(),
    status: normalizedStatus.optional(),
    startTime: requiredDate("Start time").optional(),
    endTime: requiredDate("End time").optional(),
  })
  .superRefine((match, ctx) => {
    if (Object.keys(match).length === 0) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "At least one match field must be provided",
      });
    }

    addMatchConsistencyIssues(match, ctx);
  });

export const matchIdParamsSchema = z.strictObject({
  id: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return POSITIVE_INTEGER_PATTERN.test(trimmed) ? Number(trimmed) : value;
    },
    z
      .number({
        error: "Match id must be a positive integer",
      })
      .int("Match id must be a whole number")
      .positive("Match id must be greater than zero")
      .safe("Match id is too large"),
  ),
});

export const formatValidationErrors = (error) =>
  error.issues.map((issue) => ({
    field: fieldLabel(issue.path),
    message: issue.message,
  }));

/**
 * Express Middleware factory to validate req.body payloads against a given Zod schema
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: formatValidationErrors(result.error),
    });
  }

  req.body = result.data;
  return next();
};

/**
 * Express Middleware factory to validate route URL metrics (req.params)
 */
export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: formatValidationErrors(result.error),
    });
  }

  req.params = result.data;
  return next();
};

// EXPORTED EXPRESS PIPELINE MIDDLEWARES
export const validateCreateMatch = validateBody(createMatchSchema);
export const validateUpdateMatch = validateBody(updateMatchSchema);
export const validateMatchIdParams = validateParams(matchIdParamsSchema);
