// Family / Procreation / Child-Growth system (Trello "Dragonball DND").
// Pure helpers + centralized configuration so rates and thresholds are tunable in one place.
const { races } = require('./raceData.js');

// Optional tunables from config.json (defaults below if omitted).
let familyTunables = {};
try { familyTunables = require('./.gitignore/config.json'); } catch (e) {}

// ---------- Time mapping: 1 in-game year = 3 real-world days (configurable) ----------
const AGE_UP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 real days == 1 in-game year
const WEEK_MS = AGE_UP_INTERVAL_MS; // alias (historic name; now 1 in-game year = 3 days)
const IN_GAME_YEAR_MS = AGE_UP_INTERVAL_MS;
const IN_GAME_DAY_MS = Math.floor(IN_GAME_YEAR_MS / 365); // 1 in-game day
const REAL_DAY_MS = 24 * 60 * 60 * 1000; // 1 real-world day

// ---------- Centralized configuration ----------
const FAMILY_CONFIG = {
    adultAge: 18,
    // Aging: how often a character gains +1 in-game year (3 real-world days by default).
    ageUpIntervalMs: AGE_UP_INTERVAL_MS,
    // Offline protection: a player is considered offline/inactive after 20 min without meaningful action.
    offlineTimeoutMs: 20 * 60 * 1000,
    // Child stat-growth multipliers by age band.
    childGrowth: {
        under6: 0,    // < 6  years
        under12: 0.15, // 6-11 years
        under18: 0.5,  // 12-17 years
        adult: 1       // 18+ years
    },
    // Races that can never participate in procreation (applies regardless of the other parent).
    // Saibamen are allowed: they release a seed/hatchling instead of a normal child.
    procreationIneligibleRaces: ['Vampire', 'Majin', 'Demon', 'Namekian', 'Frost Demon'],
    // Pregnancy lasts 1 real-world day (the baby "arrives" a day later, not an in-game
    // day). Override via config.json `pregnancyDurationMs`.
    pregnancyDurationMs: (typeof familyTunables.pregnancyDurationMs === 'number' ? familyTunables.pregnancyDurationMs : REAL_DAY_MS),
    // Companions must wait 1 real day after giving birth before procreating again (players have no cooldown).
    companionBirthCooldownMs: 24 * 60 * 60 * 1000,
    // Babies require feeding every hour until they reach 1 year old (the first in-game year).
    babyFoodDurationMs: IN_GAME_YEAR_MS,
    babyFeedingIntervalMs: 60 * 60 * 1000,
    babyMissedFeedingPenalty: 1, // HP lost per missed feeding
    // Hidden companion bond stat.
    companionshipThreshold: 50,
    companionshipBaseGain: 5,
    // Incest: -1d5 - 3 to every stat (rolled separately) → -4 to -8.
    incestPenalty: { count: 1, sides: 5, flat: 3 },
    incestAlignmentDrop: 65,
    birthCounts: { single: 39, twins: 47, triplets: 50 } // 1d50 roll table
};

function randInt(max) {
    return Math.floor((Math.random() * max) + 1);
}

// A character/companion's age in in-game years, from a birth timestamp.
function getAgeYears(birthDateMs, nowMs = Date.now()) {
    if (!birthDateMs) return 0;
    return Math.floor((nowMs - birthDateMs) / IN_GAME_YEAR_MS);
}

function isAdult(age) {
    return age >= FAMILY_CONFIG.adultAge;
}

// Centralized child stat-growth multiplier (0=under6, 0.15=6-11, 0.5=12-17, 1=18+).
function getChildGrowthMultiplier(age) {
    if (age < 6) return FAMILY_CONFIG.childGrowth.under6;
    if (age < 12) return FAMILY_CONFIG.childGrowth.under12;
    if (age < 18) return FAMILY_CONFIG.childGrowth.under18;
    return FAMILY_CONFIG.childGrowth.adult;
}

function isProcreationIneligibleRace(race) {
    return FAMILY_CONFIG.procreationIneligibleRaces.includes(race);
}

function canRaceProcreate(race) {
    return !isProcreationIneligibleRace(race);
}

// Roll the number of children on birth (1d50): 1-39 = 1, 40-49 = 2, 50 = 3.
function rollChildCount() {
    const roll = randInt(50);
    if (roll <= FAMILY_CONFIG.birthCounts.single) return { count: 1, roll };
    if (roll <= FAMILY_CONFIG.birthCounts.twins) return { count: 2, roll };
    return { count: 3, roll };
}

function rollChildGender() {
    return randInt(2) === 1 ? 'male' : 'female';
}

// Inherit 1d3 racial PASSIVES from both parents (excludes duplicates).
// For the special Earthling+Saiyan case the caller uses the Half-Saiyan passive set instead.
function inheritRacialAbilities(parentRaces) {
    const pool = [];
    (parentRaces || []).forEach(race => {
        const def = races[race];
        if (def && Array.isArray(def.passives)) {
            def.passives.forEach(p => { if (p && p.name && !pool.includes(p.name)) pool.push(p.name); });
        }
    });
    if (pool.length === 0) return [];
    const n = Math.min(pool.length, randInt(3));
    const chosen = [];
    const copy = [...pool];
    while (chosen.length < n && copy.length > 0) {
        const idx = randInt(copy.length) - 1;
        chosen.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return chosen;
}

// Incest penalty: -1d5 - 3 to EVERY stat, evaluated separately per stat.
function applyIncestStatPenalty(stats) {
    const out = {};
    const statKeys = ['str', 'dex', 'con', 'wil', 'spi', 'int'];
    statKeys.forEach(k => {
        const base = stats && typeof stats[k] === 'number' ? stats[k] : 0;
        const penalty = randInt(FAMILY_CONFIG.incestPenalty.sides) + FAMILY_CONFIG.incestPenalty.flat;
        out[k] = Math.max(1, base - penalty);
    });
    return out;
}

// Centralized companionship gain. Fewer companions present → faster bond growth.
// `companionCountPresent` = number of companions (including this one) accompanying the owner.
function getCompanionshipGain(companionCountPresent, activeCount = 1) {
    const n = Math.max(1, companionCountPresent);
    const presenceFactor = 1 / n;          // more companions dilutes the bond
    const activityFactor = Math.max(0.5, activeCount); // active fighters get a boost
    return Math.max(1, Math.round(FAMILY_CONFIG.companionshipBaseGain * presenceFactor * activityFactor));
}

function isCompanionshipEligibleForProcreation(companionship) {
    return (companionship || 0) >= FAMILY_CONFIG.companionshipThreshold;
}

// True when a character/companion is old enough to be a normal combat companion (6+).
function isCombatCapableChild(age) {
    return age >= 6;
}

module.exports = {
    WEEK_MS,
    IN_GAME_YEAR_MS,
    IN_GAME_DAY_MS,
    AGE_UP_INTERVAL_MS,
    FAMILY_CONFIG,
    randInt,
    getAgeYears,
    isAdult,
    getChildGrowthMultiplier,
    isProcreationIneligibleRace,
    canRaceProcreate,
    rollChildCount,
    rollChildGender,
    inheritRacialAbilities,
    applyIncestStatPenalty,
    getCompanionshipGain,
    isCompanionshipEligibleForProcreation,
    isCombatCapableChild
};
