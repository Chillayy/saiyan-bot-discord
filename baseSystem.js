// baseSystem.js
//
// Base (home) facility system — the data + math behind the `/base` menu.
//
// A "base" is the player's home (built with /craft -> Small Home / Large Home). Facilities are
// permanent upgrades to that home, paid for with resources + item requirements, that unlock
// gameplay bonuses and PASSIVE OFFLINE INCOME collected at the base.
//
// Everything here is pure data/math (no Discord dependency). The facility table below is the
// built-in default; config.json `baseSystem` overrides it (per-facility shallow merge, exactly
// like `craftingRecipes` overrides `CRAFTING_RECIPES`). Yields scale with the facility level, the
// player's INT and the saga, so a base stays relevant as the world levels up.
//
// Effect keys (all arrays are per level, index 0 = level 1):
//   gravity            — effective gravity floor for /train (like a Gravity Chamber)
//   trainingBonusPct   — flat % bonus to training stat gains
//   resourcesPerHour   — passive resources accrued offline
//   harvestDice        — dice for the manual "Harvest" action (dN × INT resources)
//   zeniPerHour        — passive zeni accrued offline (× saga)
//   craftDiscountPct   — % off the resource cost of /craft, /smith smelt+forge
//   cookDiscountPct    — % off the resource cost of /cook
//   extraRestCharges   — extra max rest charges
//   regenSpeedPct      — % faster rest-charge regeneration
//   storageBonus       — extra home storage slots
//   foodPerDay         — cooked food produced per day (collected with the rest)

const DEFAULT_BASE_CONFIG = {
    // Hours of offline accrual that can bank up before it stops. Visit/claim to reset.
    accrualCapHours: 24,
    // How strongly passive ZENI income scales with the saga. 0 = flat (saga-independent),
    // 1 = fully proportional to the saga. Kept low by default because zeni is a much softer
    // currency than resources and a fully saga-proportional vault would inflate fast.
    zeniSagaFactor: 0.1,
    // Resource upgrade costs multiply by (1 + (saga - 1) * costSagaFactor) so bases keep pace.
    costSagaFactor: 0.25,
    // Food produced by a Garden & Kitchen, picked at random when collected.
    foodPool: ['Bread', 'Dumplings', 'Hetap™', 'Vita Drink'],
    // Resource Farm manual harvest cooldown (minutes).
    harvestCooldownMinutes: 240,
    // Spaceship refueling: fuel granted per crafted fuel machine consumed, and a fallback
    // resource purchase. (Before this, ship fuel could only be handed out by an admin.)
    ship: {
        refuel: {
            'Uranium Fuel Cell Charging Bank': 300,
            'Diesel Dispenser Machine': 75,
            'Gasoline Dispenser Machine': 40
        },
        buyFuelAmount: 50,
        buyFuelResourceCost: 5000
    },
    // Facilities available at every home. `costs[i]` is the cost to reach level i+1.
    facilities: {
        trainingRoom: {
            name: 'Training Room',
            emoji: '🏋️',
            desc: 'A reinforced chamber that raises the gravity you can train under and sharpens every session.',
            maxLevel: 5,
            effects: {
                gravity: [10, 20, 50, 100, 200],
                trainingBonusPct: [8, 16, 24, 32, 40]
            },
            costs: [
                { resources: 2500, items: {} },
                { resources: 6000, items: { 'Reinforced Alloy Plate': 2 } },
                { resources: 15000, items: { 'Reinforced Alloy Plate': 5, 'Functional Motherboard': 2 } },
                { resources: 40000, items: { 'Functional Reactor Core': 2, 'Functional Motherboard': 4 } },
                { resources: 90000, items: { 'High-Output Reactor Core': 2, 'Gravitic Stabilizer': 2 } }
            ]
        },
        resourceFarm: {
            name: 'Resource Farm',
            emoji: '🌱',
            desc: 'Tended plots that generate resources while you are away, plus a node to harvest by hand.',
            maxLevel: 5,
            effects: {
                resourcesPerHour: [120, 280, 600, 1200, 2400],
                harvestDice: [20, 25, 30, 35, 40]
            },
            costs: [
                { resources: 1500, items: {} },
                { resources: 4000, items: { 'Component': 5 } },
                { resources: 10000, items: { 'Component': 10, 'Copper Wire': 10 } },
                { resources: 25000, items: { 'Reinforced Alloy Plate': 3 } },
                { resources: 60000, items: { 'Functional Motherboard': 3, 'Reinforced Alloy Plate': 6 } }
            ]
        },
        zeniVault: {
            name: 'Zeni Vault',
            emoji: '💰',
            desc: 'A secure vault whose investments pay out zeni while you are offline (scales with the saga).',
            maxLevel: 5,
            effects: {
                zeniPerHour: [1500, 4000, 9000, 20000, 45000]
            },
            costs: [
                { resources: 3000, items: {} },
                { resources: 8000, items: { 'Component': 8 } },
                { resources: 20000, items: { 'Copper Wire': 20, 'Motherboard': 2 } },
                { resources: 50000, items: { 'Advanced Circuit Matrix': 1 } },
                { resources: 110000, items: { 'Advanced Circuit Matrix': 3, 'Gravitic Stabilizer': 1 } }
            ]
        },
        workshop: {
            name: 'Workshop',
            emoji: '🔧',
            desc: 'Proper benches and tooling cut the resource cost of crafting and squeeze extra ingots out of every smelt.',
            maxLevel: 5,
            effects: {
                craftDiscountPct: [5, 10, 15, 20, 25],
                smeltBonusPct: [10, 20, 30, 40, 50]
            },
            costs: [
                { resources: 2000, items: {} },
                { resources: 5000, items: { 'Anvil': 1 } },
                { resources: 12000, items: { 'Anvil': 1, 'Smelting Forge': 1 } },
                { resources: 30000, items: { 'Functional Motherboard': 5 } },
                { resources: 70000, items: { 'High-Output Reactor Core': 1, 'Functional Motherboard': 8 } }
            ]
        },
        medBay: {
            name: 'Med Bay',
            emoji: '🛏️',
            desc: 'A recovery bay: extra rest charges and faster charge regeneration.',
            maxLevel: 5,
            effects: {
                extraRestCharges: [0, 1, 1, 2, 2],
                regenSpeedPct: [10, 20, 30, 40, 50]
            },
            costs: [
                { resources: 2500, items: {} },
                { resources: 6000, items: { "Healer's Kit": 2 } },
                { resources: 15000, items: { "Healer's Kit": 3, 'Component': 5 } },
                { resources: 35000, items: { 'Sage Water': 3 } },
                { resources: 80000, items: { 'Sage Water': 5, 'Functional Reactor Core': 1 } }
            ]
        },
        gardenKitchen: {
            name: 'Garden & Kitchen',
            emoji: '🍲',
            desc: 'Grows food while you are away and makes cooking cheaper.',
            maxLevel: 5,
            effects: {
                foodPerDay: [2, 3, 5, 8, 12],
                cookDiscountPct: [10, 20, 30, 40, 50]
            },
            costs: [
                { resources: 1200, items: {} },
                { resources: 3000, items: { 'Camp Fire': 1 } },
                { resources: 8000, items: { 'Camp Fire': 2, 'Component': 4 } },
                { resources: 20000, items: { 'Component': 10, 'Copper Wire': 10 } },
                { resources: 50000, items: { 'Functional Motherboard': 2 } }
            ]
        },
        warehouse: {
            name: 'Warehouse',
            emoji: '📦',
            desc: 'Racks and shelving that add storage slots to your home.',
            maxLevel: 5,
            effects: {
                storageBonus: [250, 600, 1200, 2500, 5000]
            },
            costs: [
                { resources: 1000, items: {} },
                { resources: 2500, items: { 'Storage Container': 1 } },
                { resources: 6000, items: { 'Storage Container': 2, 'Reinforced Alloy Plate': 2 } },
                { resources: 15000, items: { 'Reinforced Alloy Plate': 6 } },
                { resources: 40000, items: { 'Reinforced Alloy Plate': 12, 'Functional Motherboard': 4 } }
            ]
        }
    }
};

const FACILITY_ORDER = [
    'trainingRoom', 'resourceFarm', 'zeniVault', 'workshop', 'medBay', 'gardenKitchen', 'warehouse'
];

// Merge config.json `baseSystem` over the built-in defaults (per-facility shallow merge so a
// config entry can override just one effect/cost list).
function buildBaseConfig(overrides) {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_BASE_CONFIG));
    if (overrides && typeof overrides === 'object') {
        if (typeof overrides.accrualCapHours === 'number' && overrides.accrualCapHours > 0) {
            cfg.accrualCapHours = overrides.accrualCapHours;
        }
        if (typeof overrides.costSagaFactor === 'number' && overrides.costSagaFactor >= 0) {
            cfg.costSagaFactor = overrides.costSagaFactor;
        }
        if (typeof overrides.zeniSagaFactor === 'number' && overrides.zeniSagaFactor >= 0) {
            cfg.zeniSagaFactor = overrides.zeniSagaFactor;
        }
        if (Array.isArray(overrides.foodPool) && overrides.foodPool.length > 0) {
            cfg.foodPool = [...overrides.foodPool];
        }
        if (typeof overrides.harvestCooldownMinutes === 'number' && overrides.harvestCooldownMinutes > 0) {
            cfg.harvestCooldownMinutes = overrides.harvestCooldownMinutes;
        }
        if (overrides.ship && typeof overrides.ship === 'object') {
            cfg.ship = { ...cfg.ship, ...overrides.ship };
            if (overrides.ship.refuel && typeof overrides.ship.refuel === 'object') {
                cfg.ship.refuel = { ...DEFAULT_BASE_CONFIG.ship.refuel, ...overrides.ship.refuel };
            }
        }
        if (overrides.facilities && typeof overrides.facilities === 'object') {
            Object.entries(overrides.facilities).forEach(([id, def]) => {
                if (!def || typeof def !== 'object') return;
                cfg.facilities[id] = { ...(cfg.facilities[id] || {}), ...def };
            });
        }
    }
    return cfg;
}

// Ordered list of facility definitions [{ id, ...def }].
function getFacilityList(config) {
    const ids = [...FACILITY_ORDER, ...Object.keys(config.facilities).filter(id => !FACILITY_ORDER.includes(id))];
    return ids.filter(id => config.facilities[id]).map(id => ({ id, ...config.facilities[id] }));
}

function getFacilityDef(config, id) {
    const def = config.facilities[id];
    return def ? { id, ...def } : null;
}

// ----- Level lookups -----
function getFacilityLevel(character, id) {
    const map = (character && character.baseFacilities) || {};
    const lvl = Number(map[id]);
    return Number.isFinite(lvl) && lvl > 0 ? Math.floor(lvl) : 0;
}

function getFacilityLevels(character) {
    const out = {};
    FACILITY_ORDER.forEach(id => { out[id] = getFacilityLevel(character, id); });
    return out;
}

// Effect value at the character's current level (0 when unbuilt or the key is unsupported).
function getFacilityEffect(config, character, id, key) {
    const def = getFacilityDef(config, id);
    if (!def || !def.effects || !Array.isArray(def.effects[key])) return 0;
    const level = getFacilityLevel(character, id);
    if (level <= 0) return 0;
    const arr = def.effects[key];
    return Number(arr[Math.min(level, arr.length) - 1]) || 0;
}

// Every numeric bonus a character's base provides, pre-summed for the gameplay hooks.
function getBaseBonuses(config, character) {
    const ids = getFacilityList(config).map(f => f.id);
    const sum = (key) => ids.reduce((t, id) => t + getFacilityEffect(config, character, id, key), 0);
    const max = (key) => ids.reduce((t, id) => Math.max(t, getFacilityEffect(config, character, id, key)), 0);
    return {
        gravity: max('gravity'),
        trainingBonusPct: sum('trainingBonusPct'),
        resourcesPerHour: sum('resourcesPerHour'),
        harvestDice: max('harvestDice'),
        zeniPerHour: sum('zeniPerHour'),
        craftDiscountPct: Math.min(90, sum('craftDiscountPct')),
        smeltBonusPct: Math.min(200, sum('smeltBonusPct')),
        cookDiscountPct: Math.min(90, sum('cookDiscountPct')),
        extraRestCharges: sum('extraRestCharges'),
        regenSpeedPct: Math.min(90, sum('regenSpeedPct')),
        storageBonus: sum('storageBonus'),
        foodPerDay: sum('foodPerDay')
    };
}

// ----- Upgrade costs -----
// Cost to take `id` from its current level to the next. `saga` scales the resource cost.
function getUpgradeCost(config, character, id, saga = 1) {
    const def = getFacilityDef(config, id);
    if (!def) return null;
    const level = getFacilityLevel(character, id);
    if (level >= (def.maxLevel || 0)) return null;
    const base = (def.costs || [])[level];
    if (!base) return null;
    const sagaMult = 1 + Math.max(0, (Number(saga) || 1) - 1) * (config.costSagaFactor || 0);
    return {
        fromLevel: level,
        toLevel: level + 1,
        resources: Math.round((base.resources || 0) * sagaMult),
        items: { ...(base.items || {}) }
    };
}

// ----- Offline accrual -----
// Hours banked since the last claim, capped by `accrualCapHours`.
function getAccrualHours(config, character, now = Date.now()) {
    const since = Number(character && character.baseAccrualSince);
    if (!Number.isFinite(since) || since <= 0) return 0;
    const hours = Math.max(0, (now - since) / 3600000);
    return Math.min(config.accrualCapHours, hours);
}

// What the base has banked for you right now. `foodCount` is the number of food items produced;
// the caller rolls the actual items from `foodPool` when the player collects.
function computeAccrual(config, character, now = Date.now(), saga = 1) {
    const bonuses = getBaseBonuses(config, character);
    const hours = getAccrualHours(config, character, now);
    // Zeni scales with the saga only as far as `zeniSagaFactor` allows (0 = flat, 1 = proportional).
    const zeniSagaMult = 1 + (Math.max(1, Number(saga) || 1) - 1) * (config.zeniSagaFactor || 0);
    return {
        hours,
        capped: hours >= config.accrualCapHours - 1e-9,
        resources: Math.floor(bonuses.resourcesPerHour * hours),
        zeni: Math.floor(bonuses.zeniPerHour * hours * zeniSagaMult),
        foodCount: bonuses.foodPerDay > 0 ? Math.floor(bonuses.foodPerDay * hours / 24) : 0,
        hoursPerResource: bonuses.resourcesPerHour > 0 ? 1 / bonuses.resourcesPerHour : 0
    };
}

// ----- Harvest node -----
// Manual farm harvest: d(harvestDice) × INT resources, gated by a cooldown.
function getHarvestYield(config, character, rollInt) {
    const dice = getBaseBonuses(config, character).harvestDice;
    if (dice <= 0) return 0;
    const intStat = Math.max(1, Number((character.stats || {}).int) || 1);
    return Math.max(1, rollInt(dice) * intStat);
}

// ----- Display helpers -----
function formatNumber(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-US');
}

// Compact per-level summary of a facility's effects, for the menu.
function describeEffects(def, level) {
    if (!def.effects || level <= 0) return '';
    const parts = [];
    const at = (key) => {
        const arr = def.effects[key];
        if (!Array.isArray(arr)) return null;
        return Number(arr[Math.min(level, arr.length) - 1]) || 0;
    };
    if (at('gravity') != null && at('gravity') > 0) parts.push(`x${at('gravity')} gravity`);
    if (at('trainingBonusPct') != null && at('trainingBonusPct') > 0) parts.push(`+${at('trainingBonusPct')}% training`);
    if (at('resourcesPerHour') != null && at('resourcesPerHour') > 0) parts.push(`${at('resourcesPerHour')} resources/hr`);
    if (at('harvestDice') != null && at('harvestDice') > 0) parts.push(`harvest 1d${at('harvestDice')}×INT`);
    if (at('zeniPerHour') != null && at('zeniPerHour') > 0) parts.push(`${formatNumber(at('zeniPerHour'))} zeni/hr`);
    if (at('craftDiscountPct') != null && at('craftDiscountPct') > 0) parts.push(`-${at('craftDiscountPct')}% craft cost`);
    if (at('smeltBonusPct') != null && at('smeltBonusPct') > 0) parts.push(`+${at('smeltBonusPct')}% smelt yield`);
    if (at('cookDiscountPct') != null && at('cookDiscountPct') > 0) parts.push(`-${at('cookDiscountPct')}% cook cost`);
    if (at('extraRestCharges') != null && at('extraRestCharges') > 0) parts.push(`+${at('extraRestCharges')} rest charges`);
    if (at('regenSpeedPct') != null && at('regenSpeedPct') > 0) parts.push(`+${at('regenSpeedPct')}% rest regen`);
    if (at('storageBonus') != null && at('storageBonus') > 0) parts.push(`+${formatNumber(at('storageBonus'))} storage`);
    if (at('foodPerDay') != null && at('foodPerDay') > 0) parts.push(`${at('foodPerDay')} food/day`);
    return parts.join(' · ');
}

module.exports = {
    DEFAULT_BASE_CONFIG,
    FACILITY_ORDER,
    buildBaseConfig,
    getFacilityList,
    getFacilityDef,
    getFacilityLevel,
    getFacilityLevels,
    getFacilityEffect,
    getBaseBonuses,
    getUpgradeCost,
    getAccrualHours,
    computeAccrual,
    getHarvestYield,
    describeEffects,
    formatNumber
};
