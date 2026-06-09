/**
 * Deeply freezes an object or array to enforce complete runtime immutability.
 * Prevents accidental pollution or configuration manipulation.
 */

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
};

const toLookupKey = (status) => {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export const MATCH_STATUS = deepFreeze({
  UPCOMING: "UPCOMING",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  FINISHED: "FINISHED",
});

export const MATCH_STATUS_VALUES = deepFreeze(Object.values(MATCH_STATUS));

export const MATCH_STATUS_CONFIG = deepFreeze({
  [MATCH_STATUS.UPCOMING]: {
    label: "Upcoming",
    description: "Match exists, but the final start schedule is not locked.",
    isActive: false,
    isTerminal: false,
    canStreamLive: false,
    canAcceptScoreUpdates: false,
  },
  [MATCH_STATUS.SCHEDULED]: {
    label: "Scheduled",
    description: "Match is scheduled and waiting to start.",
    isActive: false,
    isTerminal: false,
    canStreamLive: false,
    canAcceptScoreUpdates: false,
  },
  [MATCH_STATUS.LIVE]: {
    label: "Live",
    description: "Match is currently in progress.",
    isActive: true,
    isTerminal: false,
    canStreamLive: true,
    canAcceptScoreUpdates: true,
  },
  [MATCH_STATUS.FINISHED]: {
    label: "Finished",
    description: "Match has ended and should no longer be mutated.",
    isActive: false,
    isTerminal: true,
    canStreamLive: false,
    canAcceptScoreUpdates: false,
  },
});

export const MATCH_STATUS_ALIASES = deepFreeze({
  COMPLETE: MATCH_STATUS.FINISHED,
  COMPLETED: MATCH_STATUS.FINISHED,
  DONE: MATCH_STATUS.FINISHED,
  FINAL: MATCH_STATUS.FINISHED,
  IN_PLAY: MATCH_STATUS.LIVE,
  INPLAY: MATCH_STATUS.LIVE,
  STARTED: MATCH_STATUS.LIVE,
  NOT_STARTED: MATCH_STATUS.SCHEDULED,
});

export const MATCH_STATUS_TRANSITIONS = deepFreeze({
  [MATCH_STATUS.UPCOMING]: [MATCH_STATUS.SCHEDULED, MATCH_STATUS.LIVE],
  [MATCH_STATUS.SCHEDULED]: [MATCH_STATUS.LIVE],
  [MATCH_STATUS.LIVE]: [MATCH_STATUS.FINISHED],
  [MATCH_STATUS.FINISHED]: [],
});

const STATUS_LOOKUP = deepFreeze(
  MATCH_STATUS_VALUES.reduce(
    (lookup, status) => {
      lookup[status] = status;
      return lookup;
    },
    { ...MATCH_STATUS_ALIASES },
  ),
);

const formatStatusList = () => MATCH_STATUS_VALUES.join(", ");

const resolveMatchStatus = (status) => {
  const lookupKey = toLookupKey(status);
  return lookupKey ? STATUS_LOOKUP[lookupKey] : undefined;
};

export const isValidMatchStatus = (status) =>
  Boolean(resolveMatchStatus(status));

export const normalizeMatchStatus = (status, options = {}) => {
  const normalized = resolveMatchStatus(status);

  if (normalized) {
    return normalized;
  }

  if (Object.hasOwn(options, "fallback")) {
    const fallback = resolveMatchStatus(options.fallback);

    if (fallback) {
      return fallback;
    }

    throw new Error(
      `Fallback match status is invalid: ${String(options.fallback)}`,
    );
  }

  throw new Error(
    `Invalid match status "${String(status)}". Expected one of: ${formatStatusList()}`,
  );
};

export const getMatchStatusConfig = (status) =>
  MATCH_STATUS_CONFIG[normalizeMatchStatus(status)];

export const getMatchStatusLabel = (status, options = {}) => {
  const normalized = normalizeMatchStatus(status, options);
  return MATCH_STATUS_CONFIG[normalized].label;
};

export const isMatchActive = (status) => getMatchStatusConfig(status).isActive;

export const isMatchTerminal = (status) =>
  getMatchStatusConfig(status).isTerminal;

export const isMatchScheduled = (status) => {
  const normalized = normalizeMatchStatus(status);
  return (
    normalized === MATCH_STATUS.UPCOMING ||
    normalized === MATCH_STATUS.SCHEDULED
  );
};

export const isMatchFinished = (status) =>
  normalizeMatchStatus(status) === MATCH_STATUS.FINISHED;

export const canStreamLive = (status) =>
  getMatchStatusConfig(status).canStreamLive;

export const canAcceptScoreUpdates = (status) =>
  getMatchStatusConfig(status).canAcceptScoreUpdates;

export const getAllowedNextMatchStatuses = (status) => {
  const normalized = normalizeMatchStatus(status);
  return MATCH_STATUS_TRANSITIONS[normalized];
};

export const canTransitionMatchStatus = (
  fromStatus,
  toStatus,
  options = {},
) => {
  const { allowNoop = true } = options;
  const from = normalizeMatchStatus(fromStatus);
  const to = normalizeMatchStatus(toStatus);

  if (allowNoop && from === to) {
    return true;
  }

  return MATCH_STATUS_TRANSITIONS[from].includes(to);
};

export const assertCanTransitionMatchStatus = (
  fromStatus,
  toStatus,
  options = {},
) => {
  if (canTransitionMatchStatus(fromStatus, toStatus, options)) {
    return true;
  }

  const from = normalizeMatchStatus(fromStatus);
  const to = normalizeMatchStatus(toStatus);
  const allowed = getAllowedNextMatchStatuses(from);
  const suffix =
    allowed.length > 0 ? allowed.join(", ") : "no further statuses";

  throw new Error(
    `Cannot transition match status from ${from} to ${to}. Allowed next statuses: ${suffix}`,
  );
};
