// statModifier.js
//
// Stat → modifier conversion using tiered scaling.
//
// The total modifier is the SUM of the points earned in EVERY completed tier, plus
// the partial (unfinished) progress inside the CURRENT tier. Because points-per-modifier
// grows with each tier, higher stats produce proportionally smaller modifiers
// (diminishing returns).

// Each tier is defined by the first and last stat value (inclusive) it covers, plus
// how many stat points are required for each +1 modifier in that tier.
const DEFAULT_MODIFIER_TIERS = [
    { start: 1,      end: 200,      pointsPerMod: 20 },    // 1 – 200        → +1 per 20
    { start: 201,    end: 1000,     pointsPerMod: 50 },    // 201 – 1,000    → +1 per 50
    { start: 1001,   end: 5000,     pointsPerMod: 100 },   // 1,001 – 5,000  → +1 per 100
    { start: 5001,   end: 20000,    pointsPerMod: 250 },   // 5,001 – 20,000 → +1 per 250
    { start: 20001,  end: 100000,   pointsPerMod: 500 },   // 20,001 – 100,000 → +1 per 500
    { start: 100001, end: Infinity, pointsPerMod: 1000 }   // 100,001+       → +1 per 1,000
];

// Backward-compatible alias (always the built-in defaults).
const MODIFIER_TIERS = DEFAULT_MODIFIER_TIERS;

// Active tier table, read by `calculateModifier`. The host app overrides it via
// `setModifierTiers()` (wired to config.json's `statModifierTiers`) so the tuning can
// be adjusted without touching code.
let activeModifierTiers = DEFAULT_MODIFIER_TIERS;

/**
 * Calculate the total modifier for a single stat.
 *
 * @param {number} stat - A single stat value (integer, minimum 0).
 * @returns {number} The total modifier as an integer. Any stat <= 0 (or non-number) returns 0.
 *
 * Example results:
 *   calculateModifier(150)     ->  7
 *   calculateModifier(750)     ->  21
 *   calculateModifier(3500)    ->  51
 *   calculateModifier(15000)   ->  106
 *   calculateModifier(75000)   ->  236
 *   calculateModifier(250000)  ->  436
 */
function calculateModifier(stat) {
    // Guard: non-positive, non-numeric, or non-finite stats have no modifier.
    if (typeof stat !== 'number' || !Number.isFinite(stat) || stat <= 0) return 0;

    let modifier = 0;

    for (const tier of activeModifierTiers) {
        // If the stat hasn't reached this tier's starting point, no higher tier applies.
        if (stat < tier.start) break;

        // `end` may be `null`/`Infinity` to mean "no ceiling" (an open-ended top tier).
        const tierEnd = (tier.end == null) ? Infinity : tier.end;

        // Number of stat points of `stat` that fall inside this tier:
        //   - the tier spans [tier.start, tier.end]
        //   - `stat` may only cover part of that span, or the whole tier.
        const pointsInTier = Math.min(stat, tierEnd) - tier.start + 1;

        // Every `pointsPerMod` points in this tier yields exactly +1 modifier;
        // the leftover (remainder) is dropped and never carries to the next tier.
        modifier += Math.floor(pointsInTier / tier.pointsPerMod);
    }

    return modifier;
}

/**
 * Override the active tier table (config-driven tuning). Invalid input reverts to the
 * built-in defaults. Returns the table that is now active.
 *
 * @param {Array<{start:number,end:number,pointsPerMod:number}>} tiers
 * @returns {Array} The active tier table.
 */
function setModifierTiers(tiers) {
    if (Array.isArray(tiers) && tiers.length > 0) {
        const cleaned = tiers
            .filter(t => t && typeof t.start === 'number' && typeof t.pointsPerMod === 'number' && t.pointsPerMod > 0)
            .sort((a, b) => a.start - b.start);
        activeModifierTiers = cleaned.length > 0 ? cleaned : DEFAULT_MODIFIER_TIERS;
    } else {
        activeModifierTiers = DEFAULT_MODIFIER_TIERS;
    }
    return activeModifierTiers;
}

/**
 * Get the currently active tier table.
 *
 * @returns {Array} The active tier table.
 */
function getModifierTiers() {
    return activeModifierTiers;
}

/**
 * Convert allocated stat-multiplier points into a multiplier.
 *
 * The base multiplier is 1.0 (no allocated points). Each point adds `0.1`
 * (+0.1 per point), so +2 → 1.2× and -3 → 0.7×. The multiplier is clamped to
 * a minimum of `minMultiplier` (default 0.7×, the lowest a stat can be lowered to).
 *
 * @param {number} points - Allocated stat-multiplier points for one stat (may be negative).
 * @param {number} [minMultiplier=0.7] - The minimum multiplier (floor) to enforce.
 * @returns {number} The multiplier to apply to a stat-derived modifier.
 */
function getStatMultiplier(points, minMultiplier = 0.7) {
    const p = Number.isFinite(points) ? points : 0;
    return Math.max(minMultiplier, 1 + 0.1 * p);
}

/**
 * Calculate the modifier for a stat after applying its stat-multiplier points.
 *
 * The base modifier (from `calculateModifier`) is multiplied by the stat's
 * multiplier, then rounded DOWN to the nearest whole number.
 *
 * @param {number} stat - A single stat value (integer, minimum 0).
 * @param {number} [points=0] - Allocated stat-multiplier points for this stat.
 * @param {number} [minMultiplier=0.7] - The minimum multiplier (floor) to enforce.
 * @returns {number} The effective modifier as an integer.
 */
function calculateModifiedModifier(stat, points = 0, minMultiplier = 0.7) {
    const base = calculateModifier(stat);
    const multiplier = getStatMultiplier(points, minMultiplier);
    return Math.floor(base * multiplier);
}

/**
 * Print a readable modifier-progression table, useful for eyeballing the curve.
 *
 * @param {number} maxStat - Highest stat value to print (default 2000).
 * @param {number} step    - How large each row's stat increment is (default 50).
 */
function printModifierTable(maxStat = 2000, step = 50) {
    console.log('Stat   ->  Modifier');
    console.log('-----      --------');
    for (let stat = 0; stat <= maxStat; stat += step) {
        console.log(String(stat).padStart(5) + '   ->  ' + String(calculateModifier(stat)).padStart(4));
    }
}

// ---------- ADDITIVE MULTIPLIER COMBINING ----------
// Gameplay modifiers are expressed as MULTIPLIERS (1.5 = +50%, 0.6 = -40%). Multiplying them
// together makes bonuses compound (1.5 × 1.4 = 2.1), so every STACK of multipliers on one value is
// ADDED instead:
//     combineMultipliers(1.5, 1.4) === 1 + (0.5 + 0.4) === 1.9
// Penalties (factors below 1) subtract from the same sum, so they can cancel bonuses out entirely;
// the result never drops below 0 (never flips a value's sign).
function combineMultipliers(...factors) {
    let sum = 0;
    for (const factor of factors) {
        const f = Number(factor);
        if (!Number.isFinite(f)) continue;
        sum += f - 1;
    }
    return Math.max(0, 1 + sum);
}

// Same rule for percentages: combinePercents(50, 25) === 1.75, combinePercents(50, -60) === 0.9.
// A percentage of -100 (or worse, summed with other penalties) floors the factor at 0.
function combinePercents(...percents) {
    let sum = 0;
    for (const pct of percents) {
        const p = Number(pct);
        if (!Number.isFinite(p)) continue;
        sum += p;
    }
    return Math.max(0, 1 + sum / 100);
}

// Apply one additive stack of multipliers to a value (rounding like the callers expect).
function applyAdditiveMultipliers(value, ...factors) {
    return Math.round(Math.max(0, Number(value) || 0) * combineMultipliers(...factors));
}

module.exports = { calculateModifier, printModifierTable, MODIFIER_TIERS, DEFAULT_MODIFIER_TIERS, setModifierTiers, getModifierTiers, getStatMultiplier, calculateModifiedModifier, combineMultipliers, combinePercents, applyAdditiveMultipliers };

// When run directly (node statModifier.js), verify the spec's example calls and
// show a sample of the progression curve. Importing this module does NOT print.
if (require.main === module) {
    const examples = [150, 750, 3500, 15000, 75000, 250000];
    const expected = { 150: 7, 750: 21, 3500: 51, 15000: 106, 75000: 236, 250000: 436 };

    console.log('Example calls:');
    for (const stat of examples) {
        const got = calculateModifier(stat);
        const ok = got === expected[stat] ? '✓' : `✗ (expected ${expected[stat]})`;
        console.log(`  calculateModifier(${stat.toLocaleString()}) = ${got}  ${ok}`);
    }

    console.log('\nProgression table (first 2000 points):');
    printModifierTable(2000, 50);
}
