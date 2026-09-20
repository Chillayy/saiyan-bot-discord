// Battle System Module
const statModifier = require('./statModifier');
const { combineMultipliers, combinePercents, applyAdditiveMultipliers } = statModifier;
const battleConfig = require('./config/config.json');
// Death-save success DC (Trello "Death Save"): a higher DC makes death saves harder to pass,
// so the Save Ally action (which auto-succeeds one save) becomes more valuable.
// Tunable via config.json `deathSaveDC` (default 10).
const DEATH_SAVE_DC = battleConfig.deathSaveDC !== undefined ? battleConfig.deathSaveDC : 10;
// Weapons grant a percentage of the wielder's physical stat modifier as bonus damage on top of
// their flat attack mod (so weapons stay relevant as stat modifiers grow with the new modifier
// system). Tunable via config.json `weaponAtkPct` (default 40).
const WEAPON_ATK_PCT = battleConfig.weaponAtkPct !== undefined ? battleConfig.weaponAtkPct : 40;
// Attack/defense dice growth (config.json `attackDiceModRatio`, default 0.35): the DEX attack and
// defense die grows with the DEX modifier so the roll stays decisive at every power level. Without
// this the die stayed ~d20-d55 while DEX modifiers reached into the hundreds, so the modifier alone
// decided every exchange: a fighter with even 10% less DEX mod won ~0% of exchanges. Higher =
// swingier (a bigger share of the die relative to the modifier).
const ATTACK_DICE_MOD_RATIO = (typeof battleConfig.attackDiceModRatio === 'number' && battleConfig.attackDiceModRatio >= 0)
    ? battleConfig.attackDiceModRatio
    : 0.35;
// Enemy NPCs only get a CHANCE to limit break (players, companions and allied helpers always do):
// 10% for a normal enemy, 50% for a boss (a raid boss or a canon-action saga defender that can
// power up via bossForms). Rolled once per battle when the low-HP condition is met.
// Tunable via config.json `enemyLimitBreakChance` / `enemyBossLimitBreakChance`.
const ENEMY_LIMIT_BREAK_CHANCE = (typeof battleConfig.enemyLimitBreakChance === 'number')
    ? battleConfig.enemyLimitBreakChance
    : 0.10;
const ENEMY_BOSS_LIMIT_BREAK_CHANCE = (typeof battleConfig.enemyBossLimitBreakChance === 'number')
    ? battleConfig.enemyBossLimitBreakChance
    : 0.50;
// A grappled defender's escape roll is multiplied by (1 + this % per roll attempted), i.e.
// each roll adds +10% of the (roll + modifier) value. Tunable via config.json
// `grappleEscapeBonus` (default 10, as a percentage).
const GRAPPLE_ESCAPE_BONUS = battleConfig.grappleEscapeBonus !== undefined ? battleConfig.grappleEscapeBonus : 10;
// Kamehameha charging (config.json `kamehamehaCharging`): per-turn charge upkeep (dice + flat %),
// charge growth/cap, and release bonus — all tunable.
const KH_CHARGING = battleConfig.kamehamehaCharging || {};
const KH_UPKEEP_DICE = (typeof KH_CHARGING.upkeepDice === 'number') ? KH_CHARGING.upkeepDice : 5;
const KH_UPKEEP_FLAT_PCT = (typeof KH_CHARGING.upkeepFlatPct === 'number') ? KH_CHARGING.upkeepFlatPct : 2;
const KH_CHARGE_PER_TURN = (typeof KH_CHARGING.chargePerTurn === 'number') ? KH_CHARGING.chargePerTurn : 2;
const KH_MAX_CHARGE = (typeof KH_CHARGING.maxCharge === 'number') ? KH_CHARGING.maxCharge : 3;
const KH_CHARGE_BONUS_PER_CHARGE = (typeof KH_CHARGING.chargeBonusPerCharge === 'number') ? KH_CHARGING.chargeBonusPerCharge : 2;
// False Super Saiyan (Trello "False Super Saiyan": "Drain: 20 Energy per turn"): the form burns
// this much Ki every turn it is held and drops at 0 Ki. Tunable via config.json
// `falseSuperSaiyan.kiPerTurn` (default 20).
const FSSJ_CFG = battleConfig.falseSuperSaiyan || {};
const FSSJ_KI_PER_TURN = (typeof FSSJ_CFG.kiPerTurn === 'number') ? FSSJ_CFG.kiPerTurn : 20;
// Crane's Mark bonus damage (Trello "Crane's Mark"): dealt when a marked entity is hit by a KI
// attack. Amount = (minPct%..maxPct% of the MARKER's WIL modifier) + flat. Tunable via
// config.json `craneMark`.
const CRANE_MARK_CFG = battleConfig.craneMark || {};
const CRANE_MARK_MIN_PCT = (typeof CRANE_MARK_CFG.minPct === 'number') ? CRANE_MARK_CFG.minPct : 0.5;
const CRANE_MARK_MAX_PCT = (typeof CRANE_MARK_CFG.maxPct === 'number') ? CRANE_MARK_CFG.maxPct : 1;
const CRANE_MARK_FLAT = (typeof CRANE_MARK_CFG.flat === 'number') ? CRANE_MARK_CFG.flat : 5;
// Bladed sword types (Konatsian Sword Proficiency / Feinting Strike).
const SWORD_TYPES = new Set(['Sword', 'Katana', 'Nodachi', 'Greatsword', 'Brave Sword', 'Dimension Sword', 'Scythe']);
function isSwordWeapon(weaponType) { return !!weaponType && SWORD_TYPES.has(weaponType); }
const POLEARM_TYPES = new Set(['Spear', 'Halberd', 'Spear of Longinus']);
function isPolearmWeapon(weaponType) { return !!weaponType && POLEARM_TYPES.has(weaponType); }
function isBeamAttack(attackType) { return attackType === 'ki'; }
// Which weapon types each fighting style can fight with. Styles not listed here are unarmed-only —
// if a fighter wields a weapon their style doesn't allow, they DON'T get that style's passives.
// Gloves/boots (`weaponUnarmed`) are treated as unarmed and are always allowed.
const STYLE_ALLOWED_WEAPONS = {
    'Swordsman': new Set(['Sword', 'Katana', 'Nodachi', 'Greatsword', 'Brave Sword', 'Dimension Sword']),
    'Shogun': new Set(['Nodachi', 'Sword', 'Katana', 'Greatsword']),
    'Legionary Discipline': new Set(['Spear', 'Halberd', 'Spear of Longinus'])
};
// Does this fighter's fighting style allow the weapon they're currently holding? Returns true when
// the fighter is unarmed (no weapon or an unarmed weapon like gloves/boots), which every style can do.
function styleAllowsWeapon(style, participant) {
    if (!style) return true;
    if (!participant.weaponType || participant.weaponUnarmed) return true;
    const allowed = STYLE_ALLOWED_WEAPONS[style];
    return !!allowed && allowed.has(participant.weaponType);
}

// Limb breaks (Trello "Injury" card) are meant to be RARE and power-independent. The attacker must
// beat the defender's save by a MARGIN that is a share of the die size, derived from the target
// chance below — so the odds stay ~10-15% whether the fighters are at stat 100 or stat 1,000,000.
// Situational effects and passives (Sharp Claws) shift the chance itself, not the dice.
// Tunable via config.json `limbBreak`.
const LIMB_BREAK_CFG = battleConfig.limbBreak || {};
const LIMB_BREAK_CHANCE_PCT = (typeof LIMB_BREAK_CFG.chancePct === 'number') ? LIMB_BREAK_CFG.chancePct : 15;
const LIMB_BREAK_CLAWS_PCT = (typeof LIMB_BREAK_CFG.sharpClawsPct === 'number') ? LIMB_BREAK_CFG.sharpClawsPct : 5;
const LIMB_BREAK_BLOCKED_PCT = (typeof LIMB_BREAK_CFG.blockedPct === 'number') ? LIMB_BREAK_CFG.blockedPct : -5;
const LIMB_BREAK_HEAD_PCT = (typeof LIMB_BREAK_CFG.headPct === 'number') ? LIMB_BREAK_CFG.headPct : -3;

class Battle {
    constructor(participants) {
        this.participants = participants; // Array of {userId, username, stats, hp, ki, fatigue}
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.round = 1;
        this.battleLog = [];
        this.active = true;
        this.limitBreakers = []; // userIds of entities that limit-broke this battle
        this.limitBreakLog = []; // { name, userId } log entries for the post-battle text
    }

    // Roll initiative (d50) for all participants.
    // Surprise round: low chance (10% base, 20% if you/your companion is an Assassin) that your
    // side strikes first — your allies get a big initiative head start so they act before enemies.
    rollInitiative() {
        this.turnOrder = this.participants.map(p => this.initParticipant(p)).sort((a, b) => b.initiative - a.initiative);
        // Canon-intervene battles have real players on BOTH sides, so a "surprise round" would
        // buff the villain and the heroes equally — and the banner would be misleading. Skip it.
        if (this.canonInterveneBattle) return this.turnOrder;
        const allies = this.turnOrder.filter(p => !p.isNPC);
        if (allies.length > 0) {
            const hasAssassin = allies.some(p => p.fightingStyle === 'Assassin');
            const chance = hasAssassin ? 0.2 : 0.1;
            if (Math.random() < chance) {
                this.surpriseRound = true;
                allies.forEach(p => { p.initiative += 100; });
                this.turnOrder.sort((a, b) => b.initiative - a.initiative);
            }
        }
        return this.turnOrder;
    }

    // Initialize a participant's battle state
    initParticipant(p) {
        return {
            ...p,
            initiative: this.rollDice(50) + (p.fightingStyle === 'Assassin' ? 8 : 0), // Shadow's Gait: +8 initiative
            currentHP: p.currentHP != null ? p.currentHP : p.hp,
            currentKi: p.currentKi != null ? p.currentKi : p.ki,
            // Entry vitals: a non-lethal training bout (spar / companion spar / mentor fight) hands
            // these back at the end, so sparring never costs HP or Ki — only fatigue.
            entryHP: p.currentHP != null ? p.currentHP : p.hp,
            entryKi: p.currentKi != null ? p.currentKi : p.ki,
            currentFatigue: p.fatigue || 0,
            failedDeathSaves: 0,
            succeededDeathSaves: 0,
            isIncapacitated: false,
            isDead: false,
            brokenLimbs: [],
            hasActed: false,
            hasBonusActed: false,
            stunned: false,
            stunnedTurns: 0,
            flying: p.flying || false,
            wolfFang: p.wolfFang || false,
            wolfFangExtraUsed: false,
            kiSense: p.kiSense || false,
            kiSharpened: p.kiSharpened || false,
            kiSharpeningActive: false,
            kiSharpeningDamagePct: 0,
            kiSharpeningDexPenalty: 0,
            kiSharpeningCost: 0,
            // Kaioken (King Kai's technique): a bonus-action toggle that multiplies combat mods.
            kaiokenActive: false,
            kaiokenCost: 0,
            kaiokenStrain: 0,
            kaiokenMods: null,
            windedTurns: 0,
            invisible: false,
            secretPoisonUsed: false,
            zanshinCooldown: 0,
            rootedBaseUsed: false,
            sphinxianTemperStacks: 0,
            sphinxianTemperBonus: 0,
            namekianDexPenalty: 0,
            bypassDR: 0,
            zenithMind: false,
            honorGuard: false,
            oneStrikeExtraDone: false,
            neoWolfFang: false,
            earlyMorningActive: false,
            earlyMorningDex: 0,
            earlyMorningCost: 0,
            shogunMarkTurns: 0,
            kamehamehaCharging: false,
            kamehamehaCharge: 0,
            // Custom /create CHARGED techniques (same upkeep/charge growth as the Kamehameha above).
            customCharging: null,
            customCharge: 0,
            customChargingName: null,
            tigerExtraActionDone: false,
            useReactions: p.useReactions !== false,
            kiApplicationLearned: p.kiApplicationLearned || false,
            kiApplicationActive: p.kiApplicationActive === true,
            kiApplicationCost: p.kiApplicationCost || 0,
            kiApplicationDex: p.kiApplicationDex || 0,
            taekwondoKickStreak: 0,
            flamingoStanding: false,
            steadyBaseUsed: false,
            polearmCharges: p.polearmCharges != null ? p.polearmCharges : 3,
            awakened: false,
            intenseAngerUsed: false,
            lssjTurns: 0,
            nextAttackDisadvantage: false,
            turnDisadvantage: false,
            nextDefenseDisadvantage: false,
            offBalance: false,
            grappledBy: null,
            grappling: null,
            bleedTurns: 0,
            poisonTurns: 0,
            rhythmStacks: 0,
            dodgedLastTurn: false,
            dodgedThisRound: false,
            concussed: false,
            ruptureTurns: 0,
            nextAttackAdvantage: false,
            nextAttackRollBonus: 0,
            nextDamageBonusDice: 0,
            pendingReaction: null,
            // Support items (consumables) are on a 5-round cooldown in combat.
            supportItemCdRound: 0,
            craneMarkTurns: 0,
            craneMarkBy: null,
            frightenedTurns: 0,
            hesitantTurns: 0,
            hopfTriggered: false,
            hopfActive: false,
            // Raid boss: acts multiple times per turn (three actions).
            isRaidBoss: p.isRaidBoss || false,
            bossStage: p.bossStage || 0,
            bossForms: p.bossForms || [],
            bossActionsPerTurn: p.bossActionsPerTurn || 3,
            bossActionsLeft: p.isRaidBoss ? (p.bossActionsPerTurn || 3) - 1 : 0,
            // Pacifist (Wise Old One) persuade: -12 to this fighter's retreat/chase rolls.
            retreatChasePenalty: p.retreatChasePenalty || 0,
            fightingStyle: p.fightingStyle || null,
            modBonus: p.modBonus || {},
            // Maniac (Sadist Limit): a combat resource that fills as damage is dealt/taken/blocked.
            sadism: 0,
            sadistMax: 100 + ((p.stats && p.stats.con) || 0),
            combatAddictedUses: 0,
            // Limit break: low-HP survival streak (≤15% HP for N straight turns).
            limitBreakTurns: 0,
            limitBreaked: false,
            // Yokai (Ghastly Structure): form is intangible until struck by a Ki-based attack.
            // While active & not exposed, physical attacks pass through; taking a Ki hit exposes it (+25% dmg).
            ghastlyActive: p.race === 'Yokai',
            ghastlyExposed: false,
            ghastlyCooldown: 0,
            // Yokai (Kitsune) Shapeshift: enemies refuse to attack this fighter for N turns.
            shapeshiftTurns: 0
        };
    }

    // Maniac (Sadist Limit): gain (1d50 + amount) sadism, capped at the character's Sadist Limit.
    gainSadism(participant, amount) {
        if (!participant || participant.fightingStyle !== 'Maniac') return 0;
        const before = participant.sadism || 0;
        const gain = this.rollDice(50) + Math.max(0, Math.round(amount || 0));
        participant.sadism = Math.min(participant.sadistMax || (100 + ((participant.stats && participant.stats.con) || 0)), before + gain);
        return participant.sadism - before;
    }

    // Maniac (Combat Addicted): at 0 HP, roll 1d20 + (remaining Sadism/2) to recover HP,
    // consuming all sadism. Usable twice per battle while sadism remains.
    checkCombatAddicted(participant) {
        if (!participant || participant.fightingStyle !== 'Maniac') return false;
        if ((participant.combatAddictedUses || 0) >= 2) return false;
        if ((participant.sadism || 0) <= 0) return false;
        const regain = this.rollDice(20) + Math.floor((participant.sadism || 0) / 2);
        participant.currentHP = Math.max(1, Math.min(participant.hp || participant.currentHP || 0, regain));
        participant.sadism = 0;
        participant.combatAddictedUses = (participant.combatAddictedUses || 0) + 1;
        participant.isIncapacitated = false;
        return true;
    }

    // Add a participant mid-battle (used by /join-mission)
    addParticipant(participant) {
        const p = this.initParticipant(participant);
        this.turnOrder.push(p);
        this.turnOrder.sort((a, b) => b.initiative - a.initiative);
        this.participants.push(participant);
        return p;
    }

    // Is this participant an NPC/enemy? Recruited allies/companions are never NPCs.
    isNPC(p) {
        if (p.isAlly === true) return false;
        return p.isNPC === true || String(p.userId).startsWith('enemy_');
    }

    // Get current turn's participant
    getCurrentTurn() {
        return this.turnOrder[this.currentTurnIndex];
    }

    // Is this participant's fighting-style passive active? Style passives only apply when the
    // fighter is unarmed or wielding a weapon their style allows (see styleAllowsWeapon).
    isStyleActive(p) {
        return !!p && styleAllowsWeapon(p.fightingStyle, p);
    }

    // Crane's Mark bonus damage: dealt whenever a MARKED entity is hit by a ki attack (per the
    // "Crane's Mark" card — the mark sears on any ki hit, not just the marking Crane's). Scales off
    // the WIL modifier of whoever APPLIED the mark so a Crane's own WIL drives it; falls back to
    // the attacker if the marker has since left the fight.
    craneMarkDamage(defender, fallback = null) {
        const span = Math.max(0, CRANE_MARK_MAX_PCT - CRANE_MARK_MIN_PCT);
        const pct = CRANE_MARK_MIN_PCT + Math.random() * span;
        const marker = (defender && defender.craneMarkBy)
            ? this.turnOrder.find(p => p.userId === defender.craneMarkBy)
            : null;
        const wilMod = Math.max(0, this.getEffectiveModifier(marker || fallback || defender, 'wil') || 0);
        return Math.floor(wilMod * pct / 100) + CRANE_MARK_FLAT;
    }

    // Advance to next turn
    nextTurn() {
        this.currentTurnIndex++;
        
        // Check if round is complete
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.round++;
            
            // Reset turn actions
            this.turnOrder.forEach(p => {
                p.hasActed = false;
                p.hasBonusActed = false;
                p.tigerExtraActionDone = false;
                p.dodgedLastTurn = p.dodgedThisRound;
                p.dodgedThisRound = false;
                // Raid boss multi-actions refresh at the start of each round.
                p.bossActionsLeft = p.isRaidBoss ? (p.bossActionsPerTurn || 3) - 1 : 0;
            });
        }

        const current = this.getCurrentTurn();
        
        // Check if current participant is dead or incapacitated
        if (current.isDead || current.isIncapacitated) {
            return this.nextTurn(); // Skip their turn
        }

        return current;
    }

    // Advance to next turn, rolling death saves for skipped combatants
    advance() {
        const log = [];
        const len = this.turnOrder.length;
        if (len === 0) return { current: null, log };

        // Clean up stale grapple links: a victim or grappler that's down (dead/incapacitated)
        // can't stay grappled, so release both sides to avoid multi-grapple/ghost holds.
        this.turnOrder.forEach(participant => {
            if (participant.grappling) {
                const victim = this.turnOrder.find(p => p.userId === participant.grappling);
                if (!victim || victim.isDead || victim.isIncapacitated) participant.grappling = null;
            }
            if (participant.grappledBy) {
                const grappler = this.turnOrder.find(p => p.userId === participant.grappledBy);
                if (!grappler || grappler.isDead || grappler.isIncapacitated) participant.grappledBy = null;
            }
            // A dodge reaction is transient — clear any stale pending prompt.
            participant.pendingReaction = null;
        });

        this.currentTurnIndex++;
        if (this.currentTurnIndex >= len) {
            this.currentTurnIndex = 0;
            this.round++;
            this.turnOrder.forEach(p => {
                p.hasActed = false;
                p.hasBonusActed = false;
                p.turnDisadvantage = false;
                p.wolfFang = false;
                p.wolfFangExtraUsed = false;
                p.tigerExtraActionDone = false;
                p.dodgedLastTurn = p.dodgedThisRound;
                p.dodgedThisRound = false;
                // Raid boss multi-actions refresh at the start of each round.
                p.bossActionsLeft = p.isRaidBoss ? (p.bossActionsPerTurn || 3) - 1 : 0;
            });
        }

        let current = this.turnOrder[this.currentTurnIndex];

        // Limit break: at ≤15% HP for 4 straight turns, the combatant breaks their limit.
        // Limit breaks only happen in real fights with a death chance — never in spars or
        // mentor (training) battles, which are non-lethal. Enemy NPCs only get a CHANCE to break
        // (see ENEMY_LIMIT_BREAK_CHANCE): 10%, or 50% for a boss; allies/companions always break.
        if (!this.isSpar && !this.isCompanionSpar && !this.isMentor
            && !current.isDead && !current.isIncapacitated && (current.currentHP || 0) > 0) {
            const maxHP = Math.max(1, current.hp || 1);
            if ((current.currentHP || 0) / maxHP <= 0.15) {
                current.limitBreakTurns = (current.limitBreakTurns || 0) + 1;
                if (current.limitBreakTurns >= 4 && !current.limitBreaked) {
                    // One attempt per battle. Players, companions and allied helpers always break;
                    // enemy NPCs only get a CHANCE (10%, or 50% for a boss).
                    current.limitBreaked = true;
                    current.limitBreakTurns = 0;
                    let breaks = true;
                    if (this.isNPC(current)) {
                        const boss = current.isRaidBoss === true || (Array.isArray(current.bossForms) && current.bossForms.length > 0);
                        const chance = boss ? ENEMY_BOSS_LIMIT_BREAK_CHANCE : ENEMY_LIMIT_BREAK_CHANCE;
                        breaks = Math.random() < chance;
                    }
                    if (breaks) {
                        // Second wind: break free of your limits and recover some HP/Ki.
                        current.currentHP = Math.min(maxHP, (current.currentHP || 0) + Math.floor(maxHP * 0.25));
                        if (current.ki) current.currentKi = Math.min(current.ki, (current.currentKi || 0) + Math.floor(current.ki * 0.5));
                        if (!this.limitBreakers.includes(current.userId)) this.limitBreakers.push(current.userId);
                        this.limitBreakLog.push({ name: current.username, userId: current.userId });
                        log.push({ type: 'limitBreak', username: current.username, userId: current.userId, round: this.round });
                    }
                }
            } else {
                current.limitBreakTurns = 0;
            }
        }

        // Pseudo-Immortality (Shenron/Porunga wish): regen HP at the start of your turn.
        if (current.pseudoImmortality && !current.isDead && !current.isIncapacitated && (current.currentHP || 0) > 0) {
            const maxHP = Math.max(1, current.hp || 1);
            // Porunga's wish is twice as strong: d20+16 instead of d20+8.
            const heal = this.rollDice(20) + (current.porungaPseudo ? 16 : 8);
            current.currentHP = Math.min(maxHP, (current.currentHP || 0) + heal);
        }

        let guard = 0;

        while ((current.isDead || current.isIncapacitated || current.stunned) && guard < len) {
            if (current.isIncapacitated && !current.isDead && current.succeededDeathSaves < 2) {
                const save = this.deathSave(current.userId);
                log.push({ type: 'deathSave', username: current.username, save });
            } else if (current.stunned && !current.isDead && !current.isIncapacitated) {
                // Stun consumes the turn, and "stuns last 1 turn longer" (Wrestler) extends it.
                current.stunnedTurns = Math.max(1, (current.stunnedTurns || 1)) - 1;
                current.hasActed = true;
                current.hasBonusActed = true;
                log.push({ type: 'stun', username: current.username });
                if (current.stunnedTurns <= 0) current.stunned = false;
            }

            guard++;
            this.currentTurnIndex++;
            if (this.currentTurnIndex >= len) {
                this.currentTurnIndex = 0;
                this.round++;
                this.turnOrder.forEach(p => {
                    p.hasActed = false;
                    p.hasBonusActed = false;
                    p.wolfFang = false;
                    p.wolfFangExtraUsed = false;
                    p.dodgedLastTurn = p.dodgedThisRound;
                    p.dodgedThisRound = false;
                });
            }
            current = this.turnOrder[this.currentTurnIndex];
        }

        if (!current || current.isDead || current.isIncapacitated) {
            this.active = false;
            return { current: null, log };
        }

        // Per-turn reaction/state resets (Taekwondo Steady Base once per turn, Flamingo Stance until next turn).
        current.steadyBaseUsed = false;
        current.flamingoStanding = false;

        // LSSJ ramp: +5 ALL MODS per turn, increasing by 5*turn each turn; +d80 Ki and 70 Ki drain per turn
        if (current.lssjActive) {
            current.lssjTurns = (current.lssjTurns || 0) + 1;
            const modGain = 5 * current.lssjTurns; // +5 ALL MODS per turn, increasing
            current.modBonus = current.modBonus || {};
            ['str', 'dex', 'con', 'wil', 'spi'].forEach(s => {
                current.modBonus[s] = (current.modBonus[s] || 0) + modGain;
            });
            const lssjKiGain = this.rollDice(80);
            const lssjDrain = 70;
            current.currentKi = Math.max(0, current.currentKi + lssjKiGain - lssjDrain);
            log.push({ type: 'lssjRamp', username: current.username, turn: current.lssjTurns, modGain, kiGain: lssjKiGain, drain: lssjDrain });
        }

        // False Super Saiyan (Trello "False Super Saiyan"): drains Ki per turn; drops the form
        // (removing +5 ALL MODS) at 0 Ki. Amount from config (`falseSuperSaiyan.kiPerTurn`).
        if (current.fssjActive) {
            const fssjDrain = Math.min(current.currentKi || 0, FSSJ_KI_PER_TURN);
            current.currentKi = Math.max(0, (current.currentKi || 0) - fssjDrain);
            if (current.currentKi <= 0) {
                current.fssjActive = false;
                current.modBonus = current.modBonus || {};
                ['str', 'dex', 'con', 'wil', 'spi'].forEach(s => {
                    current.modBonus[s] = Math.max(0, (current.modBonus[s] || 0) - 5);
                });
                log.push({ type: 'fssjDrop', username: current.username });
            } else {
                log.push({ type: 'fssjDrain', username: current.username, drain: fssjDrain });
            }
        }

        // Sustained passives drain Ki each turn they stay active (Trello "Ki Sense" 3/turn, "Fly" 10/turn).
        // If a fighter can't pay the upkeep (0 Ki), the passive turns off so its bonuses stop applying.
        if (current.kiSense) {
            const drain = Math.min(current.currentKi || 0, 3);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Ki Sense', drain, off });
            if (off) current.kiSense = false;
        }
        if (current.flying) {
            // At Fly mastery 5 the drain reduction fully covers the upkeep, so flying is free.
            const cost = Math.max(0, 10 - (current.flyDrainReduction || 0));
            const drain = Math.min(current.currentKi || 0, cost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = cost > 0 && (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Fly', drain, off });
            if (off) current.flying = false;
        }
        // Ki Application (active, non-passive): costs Ki each turn and auto-disables at 0 Ki.
        if (current.kiApplicationActive && (current.kiApplicationCost || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.kiApplicationCost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Ki Application', drain, off });
            if (off) {
                current.kiApplicationActive = false;
                current.kiAppDamage = 0;
            }
        }
        // Ki Sharpening (sustained): costs Ki each turn and auto-disables at 0 Ki.
        if (current.kiSharpeningActive && (current.kiSharpeningCost || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.kiSharpeningCost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Ki Sharpening', drain, off });
            if (off) {
                current.kiSharpeningActive = false;
                current.kiSharpeningDamagePct = 0;
                current.kiSharpeningDexPenalty = 0;
            }
        }
        // Pump Up (sustained): drains Ki per turn; drops the buff at 0 Ki (removing the stat mods).
        if (current.pumpUpActive && (current.pumpUpCost || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.pumpUpCost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Pump Up', drain, off });
            if (off) {
                current.pumpUpActive = false;
                current.pumpUpCost = 0;
                const pmods = current.pumpUpMods || {};
                current.modBonus = current.modBonus || {};
                ['str', 'con', 'dex'].forEach(s => {
                    current.modBonus[s] = Math.max(0, (current.modBonus[s] || 0) - (pmods[s] || 0));
                });
                current.pumpUpMods = null;
            }
        }
        // Kaioken (sustained): burns Ki per turn; the multiplier drops at 0 Ki (removing the mods).
        // Trello "strain": fatigue also builds every turn the multiplier is held.
        if (current.kaiokenActive && (current.kaiokenCost || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.kaiokenCost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const strain = Number(current.kaiokenStrain) || 0;
            if (strain > 0) current.currentFatigue = Math.min(100, (current.currentFatigue || 0) + strain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Kaioken', drain, strain, off });
            if (off) {
                current.kaiokenActive = false;
                current.kaiokenCost = 0;
                const kmods = current.kaiokenMods || {};
                current.modBonus = current.modBonus || {};
                ['str', 'dex', 'con', 'wil', 'spi'].forEach(s => {
                    current.modBonus[s] = Math.max(0, (current.modBonus[s] || 0) - (kmods[s] || 0));
                });
                current.kaiokenMods = null;
            }
        }
        // Active Hera form (Ultra/Ultimate Power): drains Ki per turn, drops the form at 0 Ki.
        if (current.formName && (current.formDrain || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.formDrain);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: current.formName, drain, off });
            if (off) {
                current.modBonus = current.modBonus || {};
                Object.entries(current.formMods || {}).forEach(([s, m]) => {
                    current.modBonus[s] = Math.max(0, (current.modBonus[s] || 0) - m);
                });
                current.formName = null;
                current.formDrain = 0;
                current.formMods = null;
            }
        }

        // Ki regeneration from forms at the start of the turn
        if (current.kiRegen) {
            let gained = 0;
            if (current.kiRegen.type === 'flat') {
                gained = this.rollDice(current.kiRegen.dice) + (current.kiRegen.base || 0);
            } else if (current.kiRegen.type === 'flatValue') {
                gained = (current.kiRegen.value || 0) + Math.floor(((current.ki || 1) * (current.kiRegen.pct || 0)) / 100);
            } else {
                const pct = this.rollDice(current.kiRegen.dice);
                gained = Math.floor(((current.ki || 1) * pct) / 100) + (current.kiRegen.base || 0);
            }
            // Zenkai exhaustion: Ki recovery is halved for 24h after a Zenkai.
            if (current.zenkaiExhausted) gained = Math.floor(gained / 2);
            if (gained > 0) {
                current.currentKi = Math.min(current.ki || current.currentKi, current.currentKi + gained);
                log.push({ type: 'kiRegen', username: current.username, gained });
            }
        }

        // Crane style: Ki Rejuvenation — regain 1d10+5% Ki each turn
        if (current.fightingStyle === 'Crane') {
            let craneGain = Math.max(1, Math.floor(((current.ki || 1) * (this.rollDice(10) + 5)) / 100));
            if (current.zenkaiExhausted) craneGain = Math.floor(craneGain / 2);
            current.currentKi = Math.min(current.ki || current.currentKi, current.currentKi + craneGain);
            log.push({ type: 'kiRegen', username: current.username, gained: craneGain });
        }

        // Status effects tick at the start of the affected combatant's turn
        if (current.bleedTurns > 0) {
            const bleedDamage = Math.max(1, Math.round((current.currentHP || 0) * this.rollDice(10) / 100));
            current.currentHP = Math.max(0, current.currentHP - bleedDamage);
            current.bleedTurns--;
            log.push({ type: 'bleed', username: current.username, damage: bleedDamage, turns: current.bleedTurns });
            if (current.currentHP <= 0 && !current.isIncapacitated) {
                current.isIncapacitated = true;
                current.currentHP = 0;
            }
        }
        if (current.poisonTurns > 0) {
            // Plant Life: Saibamen are immune to all forms of poison — clear the status.
            if (this.isImmuneToPoison(current)) {
                current.poisonTurns = 0;
            } else {
                const poisonDamage = this.rollDice(10);
                current.currentHP = Math.max(0, current.currentHP - poisonDamage);
                const conThrow = this.getThrowDice(current.stats.con);
                const save = this.rollDice(conThrow.dice) + this.getEffectiveModifier(current, 'con') + conThrow.flat + this.conSaveBonus(current);
                const blinded = save < 15;
                if (blinded) current.nextAttackDisadvantage = true;
                current.poisonTurns--;
                log.push({ type: 'poison', username: current.username, damage: poisonDamage, blinded, turns: current.poisonTurns });
                if (current.currentHP <= 0 && !current.isIncapacitated) {
                    current.isIncapacitated = true;
                    current.currentHP = 0;
                }
            }
        }
        // Rupture: every turn the affliction deals 1d8% max HP damage and saps 1d10% Ki.
        if (current.ruptureTurns > 0) {
            const ruptureDmg = Math.max(1, Math.round(((current.hp || 0) * this.rollDice(8)) / 100));
            const ruptureKi = Math.max(0, Math.round(((current.ki || 0) * this.rollDice(10)) / 100));
            current.currentHP = Math.max(0, current.currentHP - ruptureDmg);
            current.currentKi = Math.max(0, (current.currentKi || 0) - ruptureKi);
            current.ruptureTurns--;
            log.push({ type: 'rupture', username: current.username, damage: ruptureDmg, ki: ruptureKi, turns: current.ruptureTurns });
            if (current.currentHP <= 0 && !current.isIncapacitated) {
                current.isIncapacitated = true;
                current.currentHP = 0;
            }
        }
        // Crane's Mark tick: each turn the mark wears off; when removed, the marking Crane strips a
        // skill cooldown and forces a CON save — on failure the opponent is STUNNED for 1 turn.
        if (current.craneMarkTurns > 0) {
            current.craneMarkTurns--;
            if (current.craneMarkTurns <= 0) {
                const marker = this.turnOrder.find(p => p.userId === current.craneMarkBy && !p.isDead && !p.isIncapacitated);
                if (marker) {
                    const dc = this.modRoll(this.getEffectiveModifier(marker, 'spi'));
                    const save = this.modRoll(this.getEffectiveModifier(current, 'con'));
                    if (save < dc) {
                        current.stunned = true;
                        current.stunnedTurns = 1;
                        log.push({ type: 'craneMarkExpire', username: current.username, marker: marker.username, stunned: true });
                    } else {
                        log.push({ type: 'craneMarkExpire', username: current.username, marker: marker.username, stunned: false });
                    }
                }
                current.craneMarkBy = null;
            }
        }

        // Hope of the Universe (Give Me Everything): drains 10% max HP per turn while active.
        if (current.hopfActive && !current.isDead && !current.isIncapacitated) {
            const hopfDrain = Math.max(1, Math.round((current.hp || 0) * 0.1));
            current.currentHP = Math.max(0, current.currentHP - hopfDrain);
            log.push({ type: 'hopfDrain', username: current.username, damage: hopfDrain });
            if (current.currentHP <= 0 && !current.isIncapacitated) {
                current.isIncapacitated = true;
                current.currentHP = 0;
            }
        }

        if (current.frightenedTurns > 0) current.frightenedTurns--;
        if (current.hesitantTurns > 0) current.hesitantTurns--;
        if (current.windedTurns > 0) current.windedTurns--;
        if (current.shogunMarkTurns > 0) current.shogunMarkTurns--;
        if (current.namekianDexPenalty > 0) current.namekianDexPenalty--;
        // Yokai: tick down the Ghostly Structure cooldown & Kitsune Shapeshift duration.
        if (current.ghastlyCooldown > 0) current.ghastlyCooldown--;
        if (current.shapeshiftTurns > 0) current.shapeshiftTurns--;
        if (current.fightingStyle === 'Karate') {
            current.rootedBaseUsed = false;
            if (current.zanshinCooldown > 0) current.zanshinCooldown--;
        }
        // Early Morning (Shogun): drains Ki each turn and auto-disables at 0 Ki.
        if (current.earlyMorningActive && (current.earlyMorningCost || 0) > 0) {
            const drain = Math.min(current.currentKi || 0, current.earlyMorningCost);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const off = (current.currentKi || 0) <= 0;
            log.push({ type: 'passiveDrain', username: current.username, passive: 'Early Morning', drain, off });
            if (off) current.earlyMorningActive = false;
        }
        // Kamehameha: charging upkeep (config-driven dice + flat % of max Ki/turn), charge growth
        // and cap from config, stops at 0 Ki.
        if (current.kamehamehaCharging) {
            const upkeep = Math.max(1, Math.round(((current.ki || 0) * (this.rollDice(KH_UPKEEP_DICE) + KH_UPKEEP_FLAT_PCT)) / 100));
            const drain = Math.min(current.currentKi || 0, upkeep);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            if ((current.currentKi || 0) <= 0) {
                current.kamehamehaCharging = false;
                current.kamehamehaCharge = 0;
                log.push({ type: 'passiveDrain', username: current.username, passive: 'Kamehameha', drain, off: true });
            } else {
                current.kamehamehaCharge = Math.min(KH_MAX_CHARGE, (current.kamehamehaCharge || 0) + KH_CHARGE_PER_TURN);
                log.push({ type: 'passiveDrain', username: current.username, passive: 'Kamehameha', drain, off: false });
            }
        }
        // Custom /create charged techniques: EXACTLY the Kamehameha charging rules (Ki % drained
        // each turn, charge grows every turn, abandoned at 0 Ki).
        if (current.customCharging) {
            const upkeep = Math.max(1, Math.round(((current.ki || 0) * (this.rollDice(KH_UPKEEP_DICE) + KH_UPKEEP_FLAT_PCT)) / 100));
            const drain = Math.min(current.currentKi || 0, upkeep);
            current.currentKi = Math.max(0, (current.currentKi || 0) - drain);
            const label = current.customChargingName || 'Charged technique';
            if ((current.currentKi || 0) <= 0) {
                current.customCharging = null;
                current.customCharge = 0;
                log.push({ type: 'passiveDrain', username: current.username, passive: label, drain, off: true });
            } else {
                current.customCharge = Math.min(KH_MAX_CHARGE, (current.customCharge || 0) + KH_CHARGE_PER_TURN);
                log.push({ type: 'passiveDrain', username: current.username, passive: label, drain, off: false });
            }
        }

        // Grappled: roll d20+STR vs 15+grappler's CON mod each turn; fail = lose turn.
        // The defender's escape roll is multiplied by (1 + GRAPPLE_ESCAPE_BONUS% per roll), so
        // the hold gets easier to break the longer they're held.
        if (current.grappledBy) {
            const grappler = this.turnOrder.find(p => p.userId === current.grappledBy);
            if (grappler) {
                current.grappleEscapeCount = (current.grappleEscapeCount || 0) + 1;
                // Both sides are mod-scaled (modRoll), so the odds of breaking a hold depend on the
                // STR-vs-CON gap instead of on how large the stat modifiers have grown. The escape
                // also gains a nudge per attempt — applied to the DIE, not to the whole roll, so it
                // can't outgrow the grappler's grip every single turn.
                const strMod = this.getEffectiveModifier(current, 'str');
                const escapeDie = this.modDice(strMod);
                const escapeNudge = Math.round(escapeDie * (GRAPPLE_ESCAPE_BONUS / 100) * current.grappleEscapeCount);
                const escapeRoll = this.rollDice(escapeDie) + strMod + escapeNudge;
                // Crushing Physicality: a Wrestler grappler substitutes CON for STR (bodies the hold).
                const holdStat = grappler.fightingStyle === 'Wrestler' ? 'con' : 'str';
                const save = this.modRoll(this.getEffectiveModifier(grappler, holdStat), 15);
                if (escapeRoll >= save) {
                    grappler.grappling = null;
                    grappler.nextDefenseDisadvantage = true;
                    current.grappledBy = null;
                    log.push({ type: 'grappleEscape', username: current.username, roll: escapeRoll, save });
                } else {
                    current.hasActed = true;
                    current.hasBonusActed = true;
                    log.push({ type: 'grappleHold', username: current.username, roll: escapeRoll, save, grappler: grappler.username });
                }
            }
        }

        return { current, log };
    }

    // Roll dice with variable sides
    rollDice(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    // Calculate modifier from stat using the shared tiered scaling (statModifier.js),
    // tunable via config.json's `statModifierTiers`.
    getModifier(stat) {
        return statModifier.calculateModifier(Number(stat));
    }

    // ---------- Effective modifiers (ADDITIVE percentage stack) ----------
    // Every PERCENT modifier that applies to one stat's modifier — the stat-multiplier points, a
    // weapon's DEX inhibition, concussion, a suit of armour's DEX reduction, technique mastery, a
    // custom move's mod share — is collected here and combined ADDITIVELY (combinePercents), so
    // those modifiers can never compound with each other:
    //     +40% (stat multipliers) with a -20% weapon and -75% concussion → ×0.45, not ×0.28.
    // Flat bonuses (modBonus, injuries, Namekian ears) are added on top afterwards, as before.
    getModParts(participant, statName) {
        const stat = (participant.stats || {})[statName];
        const raw = this.getModifier(stat);
        const pcts = [];
        const sm = (participant.statMultipliers || {})[statName];
        // The stat-multiplier points contribute their exact percentage (+10% per point, the same
        // curve calculateModifiedModifier uses) so it can join the additive stack cleanly.
        if (sm && raw > 0) pcts.push((statModifier.getStatMultiplier(sm) - 1) * 100);
        // Weapon inhibiting DEX: the weapon's rolled % (scales with the stat-modifier system).
        if (statName === 'dex' && (participant.weaponDexPct || 0) > 0) pcts.push(-participant.weaponDexPct);
        // Concussion: -75% DEX mod.
        if (statName === 'dex' && participant.concussed) pcts.push(-75);
        return { raw, pcts, flat: (participant.modBonus || {})[statName] || 0 };
    }

    // One additive percentage stack applied to a parts object (extraPct joins the SAME bucket).
    modFromParts(parts, extraPct = 0) {
        let sum = Number(extraPct) || 0;
        for (const p of parts.pcts) sum += Number(p) || 0;
        return Math.round(parts.raw * combinePercents(sum));
    }

    // Modifier including flat bonuses from forms/racial passives (e.g. "+10 ALL MODS") and every
    // percentage modifier, combined additively. `extraPct` lets a caller (technique mastery, a
    // skill's own mod scaling) join the same additive bucket instead of multiplying afterwards.
    getEffectiveModifier(participant, statName, extraPct = 0) {
        const parts = this.getModParts(participant, statName);
        let mod = this.modFromParts(parts, extraPct) + parts.flat;
        // Namekian "Large Ears": a loud noise (Konatsian's Hero's Flute) gives them -7 DEX mod.
        if (statName === 'dex' && (participant.namekianDexPenalty || 0) > 0) mod -= 7;
        // Injury penalties (Trello "Injury" card).
        mod += this.getInjuryPenalty(participant, statName);
        return mod;
    }

    // Crushing Physicality: a Wrestler deals physical DAMAGE with CON (body mass) instead of STR.
    // Ki attacks still use WIL. (The hold/shove attack ROLLS already substitute CON for STR.)
    // Only applies when the Wrestler is actually fighting in-style (unarmed) — a Wrestler wielding
    // a weapon their style doesn't allow loses this passive.
    getDamageMod(participant, attackType) {
        if (attackType === 'physical' && participant.fightingStyle === 'Wrestler' && styleAllowsWeapon(participant.fightingStyle, participant)) {
            return this.getEffectiveModifier(participant, 'con');
        }
        return this.getEffectiveModifier(participant, attackType === 'physical' ? 'str' : 'wil');
    }

    // Injury penalties applied to stats, matching the Trello "Injury" card:
    // arms -3 STR/-2 DEX, legs -2 STR/-3 DEX, ribs -3 CON, head -3 STR/-3 DEX.
    getInjuryPenalty(participant, statName) {
        let pen = 0;
        for (const i of (participant.brokenLimbs || [])) {
            const limb = String(i.limb || '').toLowerCase();
            if (statName === 'str') {
                if (limb === 'arm') pen -= 3;
                else if (limb === 'leg') pen -= 2;
                else if (limb === 'head') pen -= 3;
            } else if (statName === 'dex') {
                if (limb === 'arm') pen -= 2;
                else if (limb === 'leg') pen -= 3;
                else if (limb === 'head') pen -= 3;
            } else if (statName === 'con') {
                if (limb === 'ribs') pen -= 3;
            }
        }
        return pen;
    }

    // Turtle Shell Guard: +4 + 20% CON to CON saving throws.
    conSaveBonus(participant) {
        if (participant.fightingStyle === 'Turtle') return 4 + Math.round(this.getEffectiveModifier(participant, 'con') * 0.2);
        if (participant.fightingStyle === 'Shogun') return 1; // Bushido Code: +1 to saving throws
        return 0;
    }

    // "Zenith Mind" (Potential Unleashed): immune to mind-altering effects, fear, and intimidation.
    isMindImmune(participant) {
        return !!(participant && participant.zenithMind);
    }

    // Saibamen race passives (Trello "Saibamen" card).
    // Sharp Claws — barehanded attacks can tear off limbs; all critical attacks apply bleed for 1 turn.
    hasSharpClaws(p) {
        return !!(p && p.race === 'Saibamen');
    }
    // Apex Predator — +20% to all Dexterity saving throws (bonus to dodge).
    hasApexPredator(p) {
        return !!(p && p.race === 'Saibamen');
    }
    // Plant Life — immune to all forms of poison.
    isImmuneToPoison(p) {
        return !!(p && p.race === 'Saibamen');
    }

    // Stat milestones (Trello "Milestone" card): dice size grows every power of 10
    getMilestone(stat) {
        let m = 0;
        let s = stat || 0;
        while (s >= 100) {
            s = Math.floor(s / 10);
            m++;
        }
        return m;
    }

    // Die size for a stat-based attack/throw: a d20 base + milestone steps, scaled with the stat's
    // modifier (see ATTACK_DICE_MOD_RATIO). Basic attacks use this for DEX; skills and saves use it
    // so a flat "d20 + STR/WIL mod" roll isn't left behind now that the DEX die grows with the mod.
    // `mod` defaults to the raw tier modifier derived from `stat`.
    statDice(stat, mod = null) {
        const milestone = this.getMilestone(stat);
        const modVal = Math.abs(Number(mod != null ? mod : this.getModifier(stat)) || 0);
        return 20 + 5 * milestone + Math.round(modVal * ATTACK_DICE_MOD_RATIO);
    }

    // DEX milestones + a share of the DEX mod: the basic attack/defense die size.
    getDexDice(stat) {
        return this.statDice(stat);
    }

    // A d20 (or `base`-sized) die scaled with |mod| — for "d20 + mod" skill/save contests that
    // aren't tied to a stat block (e.g. d20 + CON mod vs a DC).
    modDice(mod, base = 20) {
        return base + Math.round(Math.abs(Number(mod) || 0) * ATTACK_DICE_MOD_RATIO);
    }

    // Roll a modifier-scaled die and add the modifier: the drop-in replacement for
    // `rollDice(20) + mod` on skill attack/save contests.
    modRoll(mod, base = 20) {
        const m = Number(mod) || 0;
        return this.rollDice(this.modDice(m, base)) + m;
    }

    // Natural-max band for an attack/defense die: the top ~5% of the die ("NAT 20" on a d20).
    // Crits and fumbles use this band rather than a single face so their odds stay ~5% even though
    // the die now grows with the DEX modifier.
    natBand(dice) {
        return Math.max(1, Math.round(dice / 20));
    }

    // STR milestones: physical damage dice size (d5 -> d10 -> d15 ...)
    getStrDice(stat) {
        return 5 + 5 * this.getMilestone(stat);
    }

    // CON/WIL/SPI milestones: dice size + flat bonus on those throws (d20 -> d20+5 -> d25+6 -> d30+7 ...)
    getThrowDice(stat) {
        const m = this.getMilestone(stat);
        if (m === 0) return { dice: 20, flat: 0 };
        return { dice: 15 + 5 * m, flat: 4 + m };
    }

    // Perform attack roll
    async attack(attackerId, defenderId, attackType = 'physical', isAction = true) {
        const attacker = this.turnOrder.find(p => p.userId === attackerId);
        const defender = this.turnOrder.find(p => p.userId === defenderId);

        if (!attacker || !defender) {
            return { success: false, message: 'Invalid attacker or defender!' };
        }

        // Reset the once-per-attack Cerealian eye reroll.
        attacker.evolvedRightEyeUsed = false;

        // Check if action is available
        if (isAction && attacker.hasActed) {
            return { success: false, message: 'You have already used your action!' };
        }
        if (!isAction && attacker.hasBonusActed) {
            return { success: false, message: 'You have already used your bonus action!' };
        }

        // Ki-based attacks require Ki Application (learned from a mentor).
        if (attackType === 'ki' && !attacker.kiApplicationLearned) {
            return { success: false, message: 'You need to learn **Ki Application** from a mentor before you can use ki-based attacks!' };
        }

        // Declared early so the Off-Balance handling (below) can set flags on it before we
        // fill in the rest of the result with Object.assign further down.
        // `notices` collects player-facing one-liners for things the old code only pushed into
        // `battleLog` (never rendered): Ki spends and roll modifiers that must be explained in the
        // battle message so nobody loses Ki "for no reason".
        const result = { notices: [] };

        // Yokai (Ghastly Structure): while the form is active & not exposed, it is intangible.
        // Physical attacks pass straight through — no hit, no damage. Ki-based attacks can connect.
        if (defender.ghastlyActive && !defender.ghastlyExposed && attackType === 'physical') {
            this.battleLog.push(`👻 **${defender.username}**'s **Ghastly Structure** makes their form intangible — **${attacker.username}**'s attack passes straight through!`);
            return { success: true, hit: false, blocked: false, dodged: false, clash: false, intangible: true,
                attackRoll: 0, defenseRoll: 0, attackTotal: 0, defenseTotal: 0, critical: false, criticalFail: false,
                defenderCritFail: false, damage: 0, message: `${attacker.username}'s attack passes through ${defender.username}'s ghostly form!` };
        }
        // Whether this attack is the free third strike from Wings of the Tempest (it shouldn't
        // start a new kick streak — the counter is reset to 0 when the passive procs).
        const freeStrike = attacker.tempestQueued === true;

        const dexMod = this.getEffectiveModifier(attacker, 'dex');
        // Armor: its "defending DEX percentage reduction" joins the defender's additive DEX
        // percentage stack (weapon inhibition, concussion, stat multipliers, mastery) instead of
        // compounding with them.
        const armorDexReduction = Number(defender.armorDexReduction) || 0;
        let defDexMod = this.getEffectiveModifier(defender, 'dex', -armorDexReduction);

        // Cerealian "Exceptional Perception": every 5 strikes vs the same opponent, chance to impose a DEX debuff.
        // Hunter of Legend's "Exception Perception" is stronger: every 4 turns, d4, and on a 4 it subtracts 3 DEX.
        const hunter = attacker.mutation === 'Hunter of Legend';
        if (attacker.race === 'Cerealian') {
            if (attacker.perceptionTarget === defender.userId && attacker.perceptionCount) {
                attacker.perceptionCount = (attacker.perceptionCount || 0) + 1;
            } else {
                attacker.perceptionTarget = defender.userId;
                attacker.perceptionCount = 1;
            }
            if (hunter) {
                if (attacker.perceptionCount % 4 === 0 && this.rollDice(4) === 4) {
                    const penalty = 3;
                    defender.cerealianDexPenalty = (defender.cerealianDexPenalty || 0) + penalty;
                    const msg = `👁️ **${attacker.username}**'s **Exception Perception** tracks **${defender.username}** — **-${penalty} DEX** for the rest of combat!`;
                    this.battleLog.push(msg);
                    result.notices.push(msg + '\n');
                }
            } else if (attacker.perceptionCount % 5 === 0 && this.rollDice(5) === 5) {
                const penalty = this.rollDice(3);
                defender.cerealianDexPenalty = (defender.cerealianDexPenalty || 0) + penalty;
                const msg = `👁️ **${attacker.username}**'s **Exceptional Perception** tracks **${defender.username}** — **-${penalty} DEX** for the rest of combat!`;
                this.battleLog.push(msg);
                result.notices.push(msg + '\n');
            }
        }
        // A marked opponent always fights with a DEX penalty (regardless of who attacks them).
        if (defender.cerealianDexPenalty) {
            defDexMod = Math.round(defDexMod - (defender.cerealianDexPenalty || 0));
        }

        // DEX milestones (+ a share of the DEX mod) grow the attack/defense dice size
        const atkDice = this.getDexDice(attacker.stats.dex);
        const defDice = this.getDexDice(defender.stats.dex);
        const atkBand = this.natBand(atkDice);
        const defBand = this.natBand(defDice);

        // Initial attack roll
        let attackRoll = this.rollDice(atkDice);
        let defenseRoll = this.rollDice(defDice);
        // Shogun Mark: the marked fighter's DEX defense rolls have disadvantage.
        if ((defender.shogunMarkTurns || 0) > 0) {
            defenseRoll = Math.min(defenseRoll, this.rollDice(defDice));
        }

        // Apply disadvantage if present
        if (attacker.turnDisadvantage || attacker.nextAttackDisadvantage) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }
        attacker.nextAttackDisadvantage = false;
        // Advantage for the next attack (e.g. One-Two's stagger).
        if (attacker.nextAttackAdvantage) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.max(attackRoll, secondRoll);
            attacker.nextAttackAdvantage = false;
        }
        // Custom technique buff (/create): flat bonus to this attack roll, consumed after one use.
        if (attacker.nextAttackRollBonus) {
            result.customRollBuff = attacker.nextAttackRollBonus;
            attackRoll += attacker.nextAttackRollBonus;
            attacker.nextAttackRollBonus = 0;
        }

        // Melee attacks against a flying target have disadvantage (unless you're also flying)
        if (attackType === 'physical' && defender.flying && !attacker.flying) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        // Extended Reach (Legionary Discipline): physical attacks against a polearm wielder have disadvantage.
        if (attackType === 'physical' && defender.fightingStyle === 'Legionary Discipline' && isPolearmWeapon(defender.weaponType)) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        // Fatigue (Trello "Fatigue" card): 50%+ fatigue = disadvantage on attack rolls
        if ((attacker.currentFatigue || 0) >= 50) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        // Zenkai exhaustion: physical attacks have disadvantage for 24h after a Zenkai.
        if (attackType === 'physical' && attacker.zenkaiExhausted) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        // Wise Old One "Pacifist": disadvantage to all attacking throws (combat is meaningless to them).
        if (attacker.mutation === 'Wise Old One') {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        // Defender disadvantage on defense rolls (e.g. after a failed grapple escape)
        if (defender.nextDefenseDisadvantage) {
            const secondRoll = this.rollDice(defDice);
            defenseRoll = Math.min(defenseRoll, secondRoll);
            defender.nextDefenseDisadvantage = false;
        }

        // Fatigue (Trello "Fatigue" card): 50%+ fatigue = disadvantage on defense rolls
        if ((defender.currentFatigue || 0) >= 50) {
            const secondRoll = this.rollDice(defDice);
            defenseRoll = Math.min(defenseRoll, secondRoll);
        }

        // Zenkai exhaustion: physical defense has disadvantage for 24h after a Zenkai.
        if (attackType === 'physical' && defender.zenkaiExhausted) {
            const secondRoll = this.rollDice(defDice);
            defenseRoll = Math.min(defenseRoll, secondRoll);
        }

        // Advantage vs grappled targets and vs grapplers
        if (defender.grappledBy || defender.grappling) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.max(attackRoll, secondRoll);
        }

        // Cerealian "Evolved Right Eye": once per ki attack, spend 7 Energy to reroll (take the better).
        // Hunter of Legend's version costs only 5 Energy and adds +2 to the reroll.
        const eyeCost = hunter ? 5 : 7;
        if (attacker.race === 'Cerealian' && attackType === 'ki' && attacker.eyeRerollEnabled !== false && !attacker.evolvedRightEyeUsed && (attacker.currentKi || 0) >= eyeCost) {
            let reroll = this.rollDice(atkDice);
            if (hunter) reroll += 2;
            if (reroll > attackRoll) {
                attacker.currentKi -= eyeCost;
                attackRoll = reroll;
                // The Ki is really spent, so it MUST be shown (previously it vanished silently).
                const msg = `👁️ **${attacker.username}**'s **Evolved Right Eye** rerolls the shot: **${attackRoll}** — **${eyeCost} Ki** spent!${hunter ? ' (+2 Hunter of Legend)' : ''}`;
                this.battleLog.push(msg);
                result.notices.push(msg + '\n');
                result.eyeReroll = eyeCost;
            }
            attacker.evolvedRightEyeUsed = true;
        }

        // Konatsian "Feinting Strike": a previous critical sword strike grants advantage this attack.
        if (attacker.race === 'Konatsian' && attacker.konatsianFeint) {
            const secondRoll = this.rollDice(atkDice);
            attackRoll = Math.max(attackRoll, secondRoll);
            attacker.konatsianFeint = false;
        }

        // Flamingo Stance (Taekwondo): on a critical DEX attack roll, store the original and reroll,
        // choosing the better of the two (both can be thrown the same turn).
        if (attackRoll > atkDice - atkBand && attacker.fightingStyle === 'Taekwondo') {
            const storedRoll = attackRoll;
            const reroll = this.rollDice(atkDice);
            attackRoll = Math.max(storedRoll, reroll);
            attacker.flamingoStanding = true;
            const msg = `🦩 **${attacker.username}** switches into **Flamingo Stance** and keeps the better roll! (${storedRoll} → ${attackRoll})`;
            this.battleLog.push(msg);
            result.notices.push(msg + '\n');
        }

        // Weapons with a custom damage mode use that modifier for the attack (hit) roll too,
        // so e.g. the Bansho Fan attacks with half STR + half SPI instead of DEX.
        let attackRollMod = dexMod;
        if (attackType === 'physical' && attacker.weaponDamageMode) {
            if (attacker.weaponDamageMode === 'halfAttackHalfDex') {
                attackRollMod = Math.round((attacker.weaponAttackMod || 0) / 2) + Math.round(dexMod / 2);
            } else if (attacker.weaponDamageMode === 'halfSpiHalfStr') {
                attackRollMod = Math.round(this.getEffectiveModifier(attacker, 'spi') / 2) + Math.round(this.getEffectiveModifier(attacker, 'str') / 2);
            } else if (attacker.weaponDamageMode === 'halfWilHalfStr') {
                attackRollMod = Math.round(this.getEffectiveModifier(attacker, 'wil') / 2) + Math.round(this.getEffectiveModifier(attacker, 'str') / 2);
            }
        }
        let attackTotal = attackRoll + attackRollMod;
        let defenseTotal = defenseRoll + defDexMod;

        // Flying combatants hit more easily and are harder to hit
        if (attacker.flying) attackTotal += 2;
        if (defender.flying) {
            defenseTotal += 2;
            // Fly mastery 3: +2 DEX defense rolls while flying.
            defenseTotal += (defender.flyDexDefenseBonus || 0);
        }

        // Ki Sense: +1 to defense rolls while active
        if (defender.kiSense) defenseTotal += 1;

        // Royal Class Saiyan: +4 to all rolls while under 50% Max HP
        if (attacker.royalClass && attacker.currentHP < attacker.hp * 0.5) attackTotal += 4;
        if (defender.royalClass && defender.currentHP < defender.hp * 0.5) defenseTotal += 4;

        // Wolf Fang Fist: +10% DEX mod on attack rolls
        if (attacker.wolfFang) {
            const wfPct = attacker.wolfFangDexPct || 10;
            attackTotal += Math.max(1, Math.round(dexMod * (wfPct / 100)));
        }

        // Ki Application (active): +DEX mod on attack/defense rolls.
        if (attacker.kiApplicationActive) attackTotal += (attacker.kiApplicationDex || 0);
        if (defender.kiApplicationActive) defenseTotal += (defender.kiApplicationDex || 0);

        // Status effect penalties
        if (defender.grappledBy) defenseTotal -= Math.round(defDexMod * 0.9); // Grappled: -90% DEX defense
        if (defender.grappling) defenseTotal -= Math.round(defDexMod * 0.5);  // Grappler's DEX defense halved
        if (defender.frightenedTurns > 0 && defender.mutation !== 'Hunter of Legend') defenseTotal -= Math.round(defDexMod * 0.35);
        if (defender.craneMarkTurns > 0) defenseTotal -= Math.round(defDexMod * 0.1); // Crane's Mark: -10% DEX defense
        if (attacker.hesitantTurns > 0 && attacker.mutation !== 'Hunter of Legend') attackTotal -= Math.round(dexMod * 0.15);
        if (attacker.craneMarkTurns > 0) attackTotal -= Math.round(dexMod * 0.1); // Crane's Mark: -10% DEX attack
        // Off-Balance: -50% DEX mod on defense rolls (consumed on the next attack against them)
        if (defender.offBalance) {
            // Rooted Stance (Karate): once per round, CON save vs d20+enemy DEX to ignore Off-Balance.
            if (defender.fightingStyle === 'Karate' && !defender.rootedBaseUsed) {
                const save = this.modRoll(this.getEffectiveModifier(defender, 'con'));
                const dc = this.modRoll(dexMod);
                if (save >= dc) {
                    defender.rootedBaseUsed = true;
                    defender.offBalance = false;
                    result.rootedStance = true;
                } else {
                    defenseTotal -= Math.round(defDexMod * 0.5);
                    defender.offBalance = false;
                }
            } else if (defender.fightingStyle === 'Taekwondo' && !defender.steadyBaseUsed) {
                const save = this.modRoll(this.getEffectiveModifier(defender, 'wil'));
                const dc = this.modRoll(dexMod);
                if (save >= dc) {
                    defender.steadyBaseUsed = true;
                    defender.offBalance = false;
                    result.steadyBase = true;
                } else {
                    defenseTotal -= Math.round(defDexMod * 0.5);
                    defender.offBalance = false;
                }
            } else {
                defenseTotal -= Math.round(defDexMod * 0.5);
                defender.offBalance = false;
            }
        }

        // Fighting style passives (learned by defeating mentors). A style's passive bonuses are
        // suppressed when the fighter wields a weapon their style doesn't allow (e.g. a Boxer with
        // a sword) — unarmed fighters (incl. gloves/boots) always keep their style passives.
        const attackerStyleActive = styleAllowsWeapon(attacker.fightingStyle, attacker);
        const defenderStyleActive = styleAllowsWeapon(defender.fightingStyle, defender);
        if (attacker.fightingStyle === 'Swordsman' && attackerStyleActive) attackTotal += Math.round(dexMod * 0.25); // Practiced Technique: +25% DEX attack rolls
        // Sword Mastery (Swordsman): +1d3 attack mod to attacks with a sword.
        if (attacker.fightingStyle === 'Swordsman' && attackerStyleActive && isSwordWeapon(attacker.weaponType)) {
            attackTotal += this.rollDice(3);
        }
        // Shogun (Cleaving Swings): +30% STR mod to attack rolls.
        if (attacker.fightingStyle === 'Shogun' && attackerStyleActive) attackTotal += Math.round(this.getEffectiveModifier(attacker, 'str') * 0.3);
        // Maniac (Urge to Kill): at max sadism, +4 DEX + 50% DEX mod and +3 STR + 50% STR mod.
        if (attacker.fightingStyle === 'Maniac' && attackerStyleActive && (attacker.sadism || 0) >= (attacker.sadistMax || 0)) {
            attackTotal += 4 + Math.round(this.getEffectiveModifier(attacker, 'dex') * 0.5);
            attackTotal += 3 + Math.round(this.getEffectiveModifier(attacker, 'str') * 0.5);
        }
        if (attacker.fightingStyle === 'Turtle' && attackerStyleActive) {
            if (attackType === 'physical') attackTotal -= 4; // Not a Snapping Turtle
            // Beam Proficiency: +6 + 25% WIL and +3 + 15% DEX on beam attacks.
            else attackTotal += (6 + Math.round(this.getEffectiveModifier(attacker, 'wil') * 0.25)) + (3 + Math.round(dexMod * 0.15));
        }
        if (defender.fightingStyle === 'Turtle' && defenderStyleActive) {
            defenseTotal += 5 + Math.round(defDexMod * 0.25); // Shell Guard DEX defense
        }
        // Shogun (Masterful Parry): +5 DEX mod to defense rolls while wielding a Nodachi.
        if (defender.fightingStyle === 'Shogun' && defenderStyleActive && defender.weaponType === 'Nodachi') {
            defenseTotal += 5;
        }
        if (attacker.fightingStyle === 'Legionary Discipline' && attackerStyleActive && isPolearmWeapon(attacker.weaponType)) {
            attackTotal += this.rollDice(4); // Precision Strikes: +1d4 polearm attack mod
            // Puncture Wounds: attacking a Bleeding foe adds 1d3+STR to the DEX roll.
            if (defender.bleedTurns > 0) {
                attackTotal += this.rollDice(3) + this.getEffectiveModifier(attacker, 'str');
            }
        }
        if (attacker.fightingStyle === 'Crane' && attackerStyleActive && attackType !== 'physical') {
            attackTotal += (6 + Math.round(this.getEffectiveModifier(attacker, 'spi') * 0.25)) + (4 + Math.round(this.getEffectiveModifier(attacker, 'wil') * 0.25));
        }
        if (attacker.fightingStyle === 'Wolf' && attackerStyleActive) attackTotal += 3 + Math.round(dexMod * 0.15);
        if (defender.fightingStyle === 'Wolf' && defenderStyleActive) {
            defenseTotal += 3 + Math.round(defDexMod * 0.15); // Heightened Instincts
            defenseTotal -= 4 + Math.round(this.getEffectiveModifier(defender, 'con') * 0.2); // Vulnerable Pelt
        }
        if (attacker.fightingStyle === 'Boxing' && attackerStyleActive) attackTotal += 5 + Math.round(this.getEffectiveModifier(attacker, 'str') * 0.1);
        // Boxing Rhythm: each stack grants +1d2 DEX (stacks).
        if (attacker.rhythmStacks) {
            for (let i = 0; i < attacker.rhythmStacks; i++) attackTotal += this.rollDice(2);
        }
        if (defender.rhythmStacks) {
            for (let i = 0; i < defender.rhythmStacks; i++) defenseTotal += this.rollDice(2);
        }
        if (attacker.fightingStyle === 'Tiger' && attackerStyleActive && attacker.currentHP < attacker.hp * 0.4) {
            attackTotal += 3 + Math.round(dexMod * 0.15); // Eye of the Tiger
        }
        if (attacker.fightingStyle === 'Taekwondo' && attackerStyleActive) attackTotal += Math.round(dexMod * 0.35);
        if (defender.fightingStyle === 'Taekwondo' && defenderStyleActive) defenseTotal += Math.round(defDexMod * 0.35);
        if (defender.fightingStyle === 'Karate' && defenderStyleActive) defenseTotal += 2; // Rooted Stance

        // Ancient Wuxia Talisman: while the defender is protected, Onis/Demons have -10 mod on their attack rolls.
        if (defender.talismanActive && (attacker.race === 'Oni' || attacker.race === 'Demon')) {
            attackTotal -= 10;
        }

        // Weapon: the rolled ATTACK mod is applied as bonus DAMAGE on physical strikes
        // (see the damage section below), not added to the to-hit/DEX roll.
        // Weapons only affect physical strikes, not ki-based attacks.

        // Ki Sharpening (sustained): while active, -X% DEX mod on attack rolls.
        if (attacker.kiSharpeningActive && attacker.kiSharpeningDexPenalty) {
            attackTotal -= Math.round(dexMod * (attacker.kiSharpeningDexPenalty / 100));
        }
        // Early Morning (Shogun): +DEX mod to attack rolls while in the stance.
        if (attacker.earlyMorningActive) attackTotal += (attacker.earlyMorningDex || 0);
        // Winded: -20% DEX mod on attack rolls.
        if (attacker.windedTurns > 0) attackTotal -= Math.round(dexMod * 0.2);
        // Invisible (Assassin): +50% DEX mod while attacking, and harder to hit while defending.
        if (attacker.invisible) attackTotal += Math.round(dexMod * 0.5);
        if (defender.invisible) defenseTotal += Math.round(defDexMod * 0.5);

        // Shogun (Traditional Teachings): Swordsman's Practiced Technique when wielding a Nodachi,
        // and +15% DEX mod to attack rolls while wearing armor.
        if (attacker.fightingStyle === 'Shogun' && attackerStyleActive && attacker.weaponType === 'Nodachi') attackTotal += Math.round(dexMod * 0.25);
        if (attacker.fightingStyle === 'Shogun' && attackerStyleActive && attacker.armorReduction) attackTotal += Math.round(dexMod * 0.15);

        // Yokai (Tengu): a disciplined fighting style grants +4 to attack rolls.
        if (attacker.race === 'Yokai' && attacker.yokaiVariant === 3 && attacker.fightingStyle) {
            attackTotal += 4;
            result.tenguTraining = 4;
        }

        // Dragonhide weapons (+1 crit range): NAT 19-20 are now critical.
        const critRangeBonus = attackType === 'physical' ? (attacker.weaponCritRangeBonus || 0) : 0;

        Object.assign(result, {
            success: true,
            attackRoll,
            defenseRoll,
            attackTotal,
            defenseTotal,
            // The weapon's rolled ATTACK mod is recorded as bonus damage, not as a to-hit bonus.
            weaponAttackMod: attackType === 'physical' ? (attacker.weaponAttackMod || 0) : 0,
            // Karate (One-Strike Philosophy): crit threshold lowered 25% while above 60% HP.
            // Assassin (Shadow's Gait): attacks while invisible are always critical.
            // Dragonhide weapons (+1 crit range): the natural-max band is widened by one step.
            critical: attackRoll > atkDice - atkBand * (1 + critRangeBonus) || attacker.invisible || (attacker.fightingStyle === 'Karate' && attacker.currentHP >= (attacker.hp || 1) * 0.6 && attackRoll >= Math.floor(atkDice * 0.75)),
            criticalFail: attackRoll <= atkBand,
            defenderCritFail: defenseRoll <= defBand,
            hit: false,
            blocked: false,
            dodged: false,
            clash: false,
            damage: 0
        });

        // Assassin (Evasion Bypass): a critical DEX defense success makes you invisible.
        if (defender.fightingStyle === 'Assassin' && defenseRoll > defDice - defBand) {
            defender.invisible = true;
            result.evasionBypass = true;
        }

        // Determine if hit lands
        if (attackTotal > defenseTotal || result.defenderCritFail) {
            result.hit = true;
            // Yokai (Ghastly Structure): a connecting Ki-based attack shatters the intangible form,
            // exposing it to all attacks for the rest of combat.
            if (attackType === 'ki' && defender.ghastlyActive) {
                defender.ghastlyActive = false;
                defender.ghastlyExposed = true;
                result.ghastlyExposed = true;
            }
        } else if (attackTotal < defenseTotal || result.criticalFail) {
            // Block or dodge sequence
            let blockRoll = this.rollDice(atkDice);
            let dodgeRoll = this.rollDice(defDice);

            // Modify rolls based on crits
            if (result.criticalFail) {
                blockRoll -= 5;
            }
            if (defenseRoll > defDice - defBand) {
                dodgeRoll += 5;
            }

            const blockTotal = blockRoll + dexMod;
            let dodgeTotal = dodgeRoll + defDexMod;
            // Apex Predator: +20% to Dexterity saving throws (dodge).
            if (this.hasApexPredator(defender)) {
                dodgeTotal += Math.round(Math.max(1, defDexMod) * 0.2);
            }

            if (blockTotal > dodgeTotal || defender.earlyMorningActive) {
                result.blocked = true;
            } else if (dodgeTotal >= blockTotal) {
                result.dodged = true;
                defender.dodgedThisRound = true;

                // Head Movement (Boxing): automatic on any dodge — drain 1d5% of the ATTACKER's Ki and gain a Rhythm stack.
                if (defender.fightingStyle === 'Boxing') {
                    const drainPct = this.rollDice(5);
                    const kiDrain = Math.max(0, Math.floor(((attacker.currentKi || 0) * drainPct) / 100));
                    attacker.currentKi = Math.max(0, (attacker.currentKi || 0) - kiDrain);
                    defender.rhythmStacks = (defender.rhythmStacks || 0) + 1;
                    result.headMovement = true;
                    result.headMovementKi = kiDrain;
                }

                // Optional dodge reactions (Spirit of the Tiger / Ground Glider / Decisive Strikes).
                let reaction = null;
                if (defender.fightingStyle === 'Tiger' && defender.useReactions !== false) reaction = 'spiritTiger';
                else if (defender.fightingStyle === 'Wrestler' && !defender.grappling && defender.useReactions !== false) reaction = 'groundGlider';
                else if (defender.fightingStyle === 'Boxing' && defender.useReactions !== false) reaction = 'decisiveStrikes';

                // Real players choose via a yes/no prompt; NPCs/companions auto-apply so their AI still benefits.
                const defenderIsPlayer = !this.isNPC(defender) && !String(defender.userId).startsWith('companion_');
                if (reaction && defenderIsPlayer) {
                    defender.pendingReaction = {
                        type: reaction,
                        attackerId: attacker.userId,
                        defenderUserId: defender.userId,
                        attackType,
                        criticalFail: result.criticalFail
                    };
                    result.reactionPending = reaction;
                } else if (reaction) {
                    result.reactionText = this._applyDodgeReaction(defender, attacker, reaction, { attackType, criticalFail: result.criticalFail });
                    if (reaction === 'groundGlider') result.groundGlider = true;
                }
            }

            // Taekwondo: Phantom Step (+35% DEX) — after a dodge, the attacker must make a WIL
            // save vs d20+DEX, or become Hesitant for 1 turn.
            if (result.dodged && defender.fightingStyle === 'Taekwondo' && attacker.mutation !== 'Hunter of Legend') {
                const phantomDc = this.modRoll(this.getEffectiveModifier(defender, 'dex'));
                const phantomSave = this.modRoll(this.getEffectiveModifier(attacker, 'wil'));
                if (phantomSave < phantomDc && !this.isMindImmune(attacker)) {
                    attacker.hesitantTurns = 1;
                    result.hesitant = true;
                    result.phantomStepSave = { save: phantomSave, dc: phantomDc };
                } else {
                    result.phantomStepResist = { save: phantomSave, dc: phantomDc };
                }
            }

            result.blockRoll = blockRoll;
            result.dodgeRoll = dodgeRoll;
        } else if (attackTotal === defenseTotal) {
            // Clash! Resolve a clash frenzy (melee) or ki struggle (ki) per Trello "Clashing":
            // both parties roll repeatedly until one wins twice in a row; the winner deals their attack damage.
            result.clash = true;
            result.clashType = attackType === 'physical' ? 'frenzy' : 'struggle';
            const clashStat = attackType === 'physical' ? 'dex' : 'wil';
            const atkClashMod = this.getEffectiveModifier(attacker, clashStat);
            const defClashMod = this.getEffectiveModifier(defender, clashStat);

            let aStreak = 0, dStreak = 0;
            const rounds = [];
            let winner = null, loser = null;
            for (let i = 0; i < 20 && winner === null; i++) {
                const aRoll = this.modRoll(atkClashMod);
                const dRoll = this.modRoll(defClashMod);
                const aWin = aRoll > dRoll;
                const dWin = dRoll > aRoll;
                if (aWin) { aStreak++; dStreak = 0; }
                else if (dWin) { dStreak++; aStreak = 0; }
                else { aStreak = 0; dStreak = 0; } // a tie breaks the streak
                rounds.push({ a: aRoll, d: dRoll, aWin, dWin });
                if (aStreak >= 2) { winner = attacker; loser = defender; }
                else if (dStreak >= 2) { winner = defender; loser = attacker; }
            }
            // Fallback if somehow unresolved: higher cumulative roll wins.
            if (!winner) {
                const aTotal = rounds.reduce((s, r) => s + r.a, 0);
                const dTotal = rounds.reduce((s, r) => s + r.d, 0);
                winner = aTotal >= dTotal ? attacker : defender;
                loser = winner === attacker ? defender : attacker;
            }
            result.clashRounds = rounds;
            result.clashWinner = winner.username;
            result.clashLoser = loser.username;

            // The winning party rolls their attack roll for damage.
            const wStatMod = this.getDamageMod(winner, attackType);
            const wDamageDice = this.getStrDice(attackType === 'physical' ? winner.stats.str : winner.stats.wil);
            const wDamageRoll = this.rollDice(wDamageDice);
            let wDamage = wDamageRoll + wStatMod;
            if (winner.kiAppDamage) wDamage += winner.kiAppDamage;
            if (winner.fightingStyle === 'Tiger') {
                wDamage += 5 + Math.round(this.getEffectiveModifier(winner, 'str') * 0.25);
            }
            if (loser.fightingStyle === 'Wrestler') {
                wDamage -= this.rollDice(3) + Math.floor(this.getEffectiveModifier(loser, 'con') / 2);
            }
            wDamage = Math.max(wDamage, 0);
            result.clashDamageRoll = wDamageRoll;
            result.clashDamage = wDamage;

            // Apply damage to the loser
            loser.currentHP -= wDamage;
            result.clashLoserHP = loser.currentHP;
            if (loser.currentHP <= 0) {
                loser.isIncapacitated = true;
                result.clashKnockedOut = true;
            }
        }

        // Calculate damage if hit or blocked
        if (result.hit || result.blocked) {
            // Boxing Rhythm: getting hit (blocked or a clean hit) breaks your rhythm — lose all stacks.
            if (defender.rhythmStacks) defender.rhythmStacks = 0;
            let statMod = this.getDamageMod(attacker, attackType);

            // Weapon damage modifier (Trello "Weapons" card): bo-staff/nun-chuck use DEX,
            // katana/nodachi/duel-sai use half ATK mod + half DEX mod, bansho fan uses SPI+STR.
            // Weapons only affect physical strikes, not ki-based attacks.
            if (attackType === 'physical') {
                if (attacker.weaponDamageMode === 'dex') {
                    statMod = dexMod;
                } else if (attacker.weaponDamageMode === 'halfAttackHalfDex') {
                    statMod = Math.round((attacker.weaponAttackMod || 0) / 2) + Math.round(dexMod / 2);
                } else if (attacker.weaponDamageMode === 'halfSpiHalfStr') {
                    statMod = Math.round(this.getEffectiveModifier(attacker, 'spi') / 2) + Math.round(this.getEffectiveModifier(attacker, 'str') / 2);
                } else if (attacker.weaponDamageMode === 'halfWilHalfStr') {
                    statMod = Math.round(this.getEffectiveModifier(attacker, 'wil') / 2) + Math.round(this.getEffectiveModifier(attacker, 'str') / 2);
                }
                // Konatsian "Sword Proficiency": +5% STR mod to attacks done with swords (min +1).
                if (attacker.race === 'Konatsian' && isSwordWeapon(attacker.weaponType)) {
                    statMod += Math.max(1, Math.round(this.getEffectiveModifier(attacker, 'str') * 0.05));
                }
            }

            // Damage dice use the STR milestone pattern for both STR (physical) and WIL (ki):
            // 1d5 -> 1d10 (100) -> 1d15 (1000) -> 1d20 (10000) ...
            const damageDice = this.getStrDice(attackType === 'physical' ? attacker.stats.str : attacker.stats.wil);
            let damageRoll = this.rollDice(damageDice);
            let damage = damageRoll + statMod;
            let flatBonus = 0;

            // Wolf (Swift Onslaught): a barrage — two rapid strikes, each d2 + STR mod/2.
            if (attacker.fightingStyle === 'Wolf' && attackerStyleActive && attackType === 'physical') {
                const strHalf = Math.floor(this.getEffectiveModifier(attacker, 'str') / 2);
                const per1 = Math.max(1, this.rollDice(2) + strHalf);
                const per2 = Math.max(1, this.rollDice(2) + strHalf);
                damage = per1 + per2;
                damageRoll = `${per1} + ${per2}`;
                result.wolfBarrage = 2;
                statMod = 0;
            }

            // Weapon ATK mod: a flat bonus added to the base damage. The weapon's atk % is
            // applied as a multiplier at the end — (base roll + mod + bonus) * weapon atk addon.
            // Only physical strikes using the default STR damage mode add the flat mod here, so
            // special damage-mode weapons (katana, bo-staff, etc.) don't double-count it.
            if (attackType === 'physical' && attacker.weaponAttackMod && (!attacker.weaponDamageMode || attacker.weaponDamageMode === 'str')) {
                damage += attacker.weaponAttackMod;
                flatBonus += attacker.weaponAttackMod;
            }

            // Reinforced Gloves / Steel-Toe Boots: grants an additional STR bonus to unarmed strikes.
            if (attackType === 'physical' && attacker.weaponPunchStrBonus && attacker.weaponUnarmed) {
                const pExpr = String(attacker.weaponPunchStrBonus).trim();
                const pm = /^(\d*)d(\d+)(?:\s*\+\s*(\d+))?$/i.exec(pExpr);
                let punchRoll = 0;
                if (pm) {
                    const count = pm[1] ? parseInt(pm[1], 10) : 1;
                    const sides = parseInt(pm[2], 10);
                    const flat = pm[3] ? parseInt(pm[3], 10) : 0;
                    let sum = 0;
                    for (let i = 0; i < count; i++) sum += this.rollDice(sides);
                    punchRoll = sum + flat;
                }
                // Only the rolled dice add here — the full STR modifier is already included in the
                // base damage via statMod, so adding it again would double-count it (way too much).
                const punchBonus = punchRoll;
                damage += punchBonus;
                flatBonus += punchBonus;
            }

            // Ki Application: +flat attack damage (ability learned from a mentor)
            if (attacker.kiAppDamage) {
                damage += attacker.kiAppDamage;
                flatBonus += attacker.kiAppDamage;
            }

            // Custom /create "buff damage" charge adds bonus damage on the next strike.
            if (attacker.nextDamageBonusDice) {
                const charged = this.rollDice(attacker.nextDamageBonusDice);
                damage += charged;
                flatBonus += charged;
                attacker.nextDamageBonusDice = 0;
            }

            // Forged ores (Soulstone/Ebonite): add a % of the wearer's SPI/WIL mod to physical damage.
            if (attackType === 'physical') {
                if (attacker.weaponSpiDmgPct) {
                    const spiBonus = Math.max(0, Math.round(this.getEffectiveModifier(attacker, 'spi') * (attacker.weaponSpiDmgPct / 100)));
                    damage += spiBonus;
                    flatBonus += spiBonus;
                }
                if (attacker.weaponWilDmgPct) {
                    const wilBonus = Math.max(0, Math.round(this.getEffectiveModifier(attacker, 'wil') * (attacker.weaponWilDmgPct / 100)));
                    damage += wilBonus;
                    flatBonus += wilBonus;
                }
            }

            // Karate (Kime): channel your will into the strike — add SPI mod to damage.
            if (attacker.fightingStyle === 'Karate' && attackerStyleActive) {
                const kime = Math.max(0, this.getEffectiveModifier(attacker, 'spi'));
                damage += kime;
                flatBonus += kime;
            }
            // Maniac (Sadist Limit): damage is tracked for the sadism gauge (applied after the hit resolves).
            // Neo Wolf Fang Fist: +25% STR mod to damage, 1d5 chance to bleed.
            if (attacker.neoWolfFang) {
                const nwf = Math.max(0, Math.round(this.getEffectiveModifier(attacker, 'str') * 0.25));
                damage += nwf;
                flatBonus += nwf;
                result.neoWolfFangStr = nwf;
                if (this.rollDice(5) === 5) {
                    const bleed = this.rollDice(3);
                    defender.bleedTurns = (defender.bleedTurns || 0) + bleed;
                    result.neoWolfFangBleed = bleed;
                }
            }
            // Assassin (Predator's Finish): +15% damage to foes under 30% HP.
            if (attacker.fightingStyle === 'Assassin' && attackerStyleActive && defender.currentHP < (defender.hp || 1) * 0.3) {
                const finisher = Math.round(damage * 0.15);
                damage += finisher;
                flatBonus += finisher;
                result.predatorsFinish = finisher;
            }
            // Assassin (Toxic Executioner): +1d10% damage to foes under a damage-over-time effect.
            if (attacker.fightingStyle === 'Assassin' && attackerStyleActive && ((defender.bleedTurns || 0) > 0 || (defender.poisonTurns || 0) > 0 || (defender.ruptureTurns || 0) > 0)) {
                const toxic = Math.round(damage * (this.rollDice(10) / 100));
                damage += toxic;
                flatBonus += toxic;
                result.toxicExecutioner = toxic;
            }

            // Tiger: Fearless Strikes (+(5+25% STR) to damage)
            if (attacker.fightingStyle === 'Tiger' && attackerStyleActive) {
                const tiger = 5 + Math.round(this.getEffectiveModifier(attacker, 'str') * 0.25);
                damage += tiger;
                flatBonus += tiger;
            }
            // Wrestler: Ring Fortitude (negate d3 + CON mod/2 when taking damage)
            if (defender.fightingStyle === 'Wrestler' && defenderStyleActive) {
                const wrestler = this.rollDice(3) + Math.floor(this.getEffectiveModifier(defender, 'con') / 2);
                damage -= wrestler;
                flatBonus -= wrestler;
            }

            // Wings of the Tempest (Taekwondo): the free third strike carries +DEX mod damage.
            if (attacker.tempestQueued) {
                const tempest = Math.max(0, this.getEffectiveModifier(attacker, 'dex'));
                damage += tempest;
                flatBonus += tempest;
                result.tempestStrikeDmg = tempest;
                attacker.tempestQueued = false;
            }

            // Precision Strikes (Legionary Discipline): spend 5+5% Ki to add 25% DEX to polearm damage.
            if (attacker.fightingStyle === 'Legionary Discipline' && attackerStyleActive && isPolearmWeapon(attacker.weaponType)) {
                const cost = 5 + Math.round((attacker.ki || 0) * 0.05);
                if ((attacker.currentKi || 0) >= cost) {
                    attacker.currentKi -= cost;
                    const ps = Math.round(dexMod * 0.25);
                    damage += ps;
                    flatBonus += ps;
                    result.precisionDex = ps;
                    // The style auto-spends Ki on every polearm hit: report the spend, otherwise the
                    // attacker watches their Ki disappear with nothing in the log explaining it.
                    result.precisionKi = cost;
                    result.notices.push(`⚔️ **Precision Strikes** (Legionary Discipline) — spent **${cost} Ki** for **+${ps}** polearm damage!\n`);
                }
            }

            // Crane's Mark: a ki attack on a marked entity deals extra damage, scaled off the
            // marker's WIL modifier (see craneMarkDamage). Not restricted to Crane attackers — the
            // mark itself is what sears.
            if (defender.craneMarkTurns > 0 && attackType === 'ki') {
                const markDmg = this.craneMarkDamage(defender, attacker);
                damage += markDmg;
                flatBonus += markDmg;
                result.craneMarkBonus = markDmg;
            }

            // ----- ADDITIVE DAMAGE STACKS -----
            // Every flat addition above is done: `flatBase` is the value all PERCENT terms below are
            // measured against, so they ADD together (combinePercents) instead of compounding on the
            // running total. A weapon's atk%, Ki Sharpening, Exposing Wounds, Destructive Instinct
            // and a Yokai's vulnerability now sum (+25% +25% +10% +40% = +100%) rather than
            // multiplying (1.25 × 1.25 × 1.10 × 1.40 = 2.4×), and the defender's block/armour/Turtle
            // reductions likewise ADD into one reduction.
            const flatBase = Math.max(0, damage);

            // Turtle Tenacity: a Turtle hit by a Ki attack absorbs 1d20% of the Ki used and
            // negates 1d15 + 25% of the damage.
            if (defender.fightingStyle === 'Turtle' && defenderStyleActive && attackType === 'ki') {
                // The 25% joins the additive reduction stack (applied below); the d15 stays a flat.
                result.turtleTenacityPct = 25;
                const kiUsed = Math.round((attacker.ki || 0) * 0.2); // approx ki spent on the attack
                const absorb = Math.max(0, Math.floor((this.rollDice(20) / 100) * kiUsed));
                if (absorb > 0) {
                    defender.currentKi = Math.min(defender.ki || (defender.currentKi || 0), (defender.currentKi || 0) + absorb);
                    result.turtleAbsorb = absorb;
                }
            }

            // Critical hit bonus
            if (result.critical) {
                damage += 5;
                flatBonus += 5;
                // Assassin's Touch: critical STR attack rolls deal 2x damage (+100% of the base).
                if (attacker.fightingStyle === 'Assassin') {
                    damage += flatBase;
                    flatBonus += flatBase;
                    result.assassinsTouch = true;
                }
                // Karate (Kime): a critical hit forces a WIL save (d20+SPI) or STUN 1 turn.
                if (attacker.fightingStyle === 'Karate') {
                    const wilDc = this.modRoll(this.getEffectiveModifier(attacker, 'spi'));
                    const wilSave = this.modRoll(this.getEffectiveModifier(defender, 'wil'));
                    if (wilSave < wilDc && !this.isMindImmune(defender)) {
                        defender.stunned = true;
                        defender.stunnedTurns = 1;
                        result.kimeStun = true;
                    }
                }
                // Karate (One-Strike Philosophy): on an unarmed critical, gain a free action once/turn.
                if (attacker.fightingStyle === 'Karate' && !attacker.weapon && !attacker.oneStrikeExtraDone) {
                    attacker.oneStrikeExtraDone = true;
                    attacker.hasActed = false;
                    result.oneStrike = true;
                }
                // Fearless Strikes (Tiger): on a critical, regain the action and impose disadvantage
                // on the opponent. Only once per turn.
                if (attacker.fightingStyle === 'Tiger' && !attacker.tigerExtraActionDone) {
                    attacker.tigerExtraActionDone = true;
                    defender.nextDefenseDisadvantage = true;
                    result.tigerExtraAction = true;
                }
            }

            // Ki Sharpening (one-shot legacy): +1d4 damage on the next attack after sharpening
            if (attacker.kiSharpened) {
                const sharp = this.rollDice(4);
                damage += sharp;
                flatBonus += sharp;
                attacker.kiSharpened = false;
            }
            // Custom technique buff (/create): flat bonus to this attack's damage, consumed after one use.
            if (attacker.nextAttackDamageBonus) {
                damage += attacker.nextAttackDamageBonus;
                flatBonus += attacker.nextAttackDamageBonus;
                result.customDamageBuff = attacker.nextAttackDamageBonus;
                attacker.nextAttackDamageBonus = 0;
            }
            // Ki Sharpening (sustained): while active, +X% to damage rolls (additive term).
            if (attacker.kiSharpeningActive && attacker.kiSharpeningDamagePct) {
                const sharpBonus = Math.round(flatBase * (attacker.kiSharpeningDamagePct / 100));
                damage += sharpBonus;
                flatBonus += sharpBonus;
                result.kiSharpeningBonus = sharpBonus;
            }

            // ----- Defender-side reductions (ONE ADDITIVE STACK) -----
            // Block %, Shogun's Honor Guard (half through the block), Turtle Tenacity's 25% and the
            // armour's rolled % all ADD together and are subtracted as one term measured against
            // `flatBase`, instead of each multiplying the shrinking remainder.
            let blockPct = 0;
            let tenacityFlat = 0;
            let blockPrevented = 0;
            let blockedDamage = 0;
            if (result.blocked) {
                let negatePct = 80;
                if (defender.fightingStyle === 'Turtle') {
                    const extra = this.rollDice(10);
                    negatePct = Math.min(100, negatePct + extra);
                    result.shellGuard = extra;
                }
                // "Potential Unleashed": attacks bypass the first N points of damage reduction/resistance.
                if (attacker.bypassDR) negatePct = Math.max(0, negatePct - attacker.bypassDR);
                // Shogun (Honor Guard Stance): when blocking, half of the damage goes through the block.
                if (defender.fightingStyle === 'Shogun') {
                    defender.honorGuard = true;
                    negatePct = Math.max(0, negatePct - 50);
                    result.honorGuard = true;
                }
                blockPct = negatePct;
                blockPrevented = Math.round(flatBase * negatePct / 100);
                damage = Math.max(0, damage - blockPrevented);
                blockedDamage = blockPrevented;
                // Early Morning (Shogun): counterattack when blocking.
                if (defender.earlyMorningActive) {
                    const counter = this.rollDice(this.getStrDice(defender.stats.str)) + this.getEffectiveModifier(defender, 'str');
                    attacker.currentHP = Math.max(0, (attacker.currentHP || 0) - counter);
                    result.earlyMorningCounter = counter;
                    if (attacker.currentHP <= 0) attacker.isIncapacitated = true;
                }
                // Honor Guard (Shogun): vs an unarmed attacker, force a CON save (15+DMG/2); on
                // fail, full damage goes through and the attacker is Shogun-Marked. The extra damage
                // is a +100% ADDITIVE term on the base (not a doubling of the running total).
                if (defender.fightingStyle === 'Shogun' && !attacker.weapon) {
                    const saveDc = 15 + Math.floor(damage / 2);
                    const save = this.modRoll(this.getEffectiveModifier(attacker, 'con'));
                    if (save < saveDc) {
                        damage += flatBase;
                        flatBonus += flatBase;
                        attacker.shogunMarkTurns = (attacker.shogunMarkTurns || 0) + 1;
                        result.shogunMark = true;
                    }
                }
                // Iron Bone Conditioning (Tiger): when blocking an UNARMED physical attack,
                // reflect d3+(Blocked Damage/2) back at the attacker.
                if (defender.fightingStyle === 'Tiger' && attackType === 'physical' && !attacker.weapon) {
                    const ironBone = this.rollDice(3) + Math.floor(blockedDamage / 2);
                    attacker.currentHP -= ironBone;
                    result.ironBone = ironBone;
                    if (attacker.currentHP <= 0) attacker.isIncapacitated = true;
                }
            }
            if (result.turtleTenacityPct) {
                tenacityFlat = this.rollDice(15);
                result.turtleTenacity = Math.round(flatBase * result.turtleTenacityPct / 100) + tenacityFlat;
            }

            // Exposing Wounds (Swordsman): attacking a bleeding foe adds +25% total damage (additive).
            if (attacker.fightingStyle === 'Swordsman' && (defender.bleedTurns || 0) > 0) {
                const exposing = Math.floor(flatBase * 0.25);
                damage += exposing;
                flatBonus += exposing;
                result.exposingWounds = exposing;
            }

            // Sphinxian "Destructive Instinct": +10% damage against foes above 50% max HP (additive).
            if (attacker.race === 'Sphinxian' && (defender.currentHP || 0) > (defender.hp || 1) * 0.5) {
                const di = Math.round(flatBase * 0.10);
                damage += di;
                flatBonus += di;
                result.destructiveInstinct = di;
            }
            // Sphinxian "Short Temper": spend accumulated stacks on your next landed hit, then reset.
            if (attacker.race === 'Sphinxian' && result.hit && (attacker.sphinxianTemperStacks || 0) > 0) {
                const temper = Math.round(attacker.sphinxianTemperBonus || 0);
                damage += temper;
                flatBonus += temper;
                result.shortTemper = temper;
                attacker.sphinxianTemperStacks = 0;
                attacker.sphinxianTemperBonus = 0;
            }

            // Weapon atk addon: +atk% of the BASE (an additive term, so it no longer compounds with
            // Ki Sharpening / Exposing Wounds / a Yokai's vulnerability). A weapon with a rolled 0%
            // (×1.00) must NOT fall back to the global default.
            if (attackType === 'physical' && attacker.weaponAttackMod) {
                const weaponPct = (typeof attacker.weaponAtkPct === 'number') ? attacker.weaponAtkPct : WEAPON_ATK_PCT;
                damage += Math.round(flatBase * weaponPct / 100);
                flatBonus += Math.round(flatBase * weaponPct / 100);
                result.weaponAtkMult = weaponPct;
            }

            result.damage = Math.max(damage, 0);
            result.damageRoll = damageRoll;
            result.statMod = statMod;
            result.flatBonus = flatBonus;
            result.baseDamage = flatBase;
            result.blockPct = blockPct;

            // Grapple interactions: a blocked attack makes the grappled target take the damage instead;
            // a landed hit breaks the grapple
            if (defender.grappling) {
                const grappledTarget = this.turnOrder.find(p => p.userId === defender.grappling);
                if (result.blocked && grappledTarget && !grappledTarget.isDead && !grappledTarget.isIncapacitated) {
                    grappledTarget.currentHP -= result.damage;
                    if (grappledTarget.currentHP <= 0) grappledTarget.isIncapacitated = true;
                    result.grappledTargetHit = grappledTarget.username;
                    result.damage = 0;
                } else if (result.hit && grappledTarget) {
                    grappledTarget.grappledBy = null;
                    defender.grappling = null;
                    result.grappleBroken = true;
                }
            }

            // Armor + Turtle Tenacity: the last members of the defence-side additive stack. Their %
            // terms are measured against `flatBase` (so they no longer compound with each other or
            // with a block); Tenacity's trailing d15 stays a flat subtraction.
            const armorRed = defender.armorReduction
                ? Math.max(0, defender.armorReduction - (attacker.bypassDR || 0))
                : 0;
            const armorPrevented = armorRed > 0 ? Math.round(flatBase * armorRed / 100) : 0;
            if (armorPrevented > 0) result.armorBlock = armorPrevented;
            const tenacityPrevented = result.turtleTenacityPct ? Math.round(flatBase * result.turtleTenacityPct / 100) : 0;
            if (armorPrevented > 0 || tenacityPrevented > 0 || tenacityFlat > 0) {
                result.damage = Math.max(0, result.damage - armorPrevented - tenacityPrevented - tenacityFlat);
            }

            // Yokai (Ghastly Structure): the ghostly form takes +25% damage from all sources — an
            // additive term on the base, so it adds to the attacker's other bonuses instead of
            // multiplying the finished number.
            if (defender.race === 'Yokai' && flatBase > 0) {
                const ghostDmg = Math.floor(flatBase * 0.25);
                if (ghostDmg > 0) {
                    result.damage += ghostDmg;
                    result.ghastlyBonus = ghostDmg;
                    result.ghastlyExposed = defender.ghastlyExposed;
                }
            }

            // Apply damage
            defender.currentHP -= result.damage;

            // Sphinxian "Short Temper": taking damage builds stackable rage on their next attack.
            if (defender.race === 'Sphinxian' && result.damage > 0 && !defender.isIncapacitated) {
                const stacks = defender.sphinxianTemperStacks || 0;
                if (stacks < 3) {
                    const wilMod = this.getEffectiveModifier(defender, 'wil');
                    const gain = this.rollDice(10) + Math.floor(wilMod * 0.1);
                    defender.sphinxianTemperBonus = (defender.sphinxianTemperBonus || 0) + gain;
                    defender.sphinxianTemperStacks = stacks + 1;
                    result.shortTemperGained = gain;
                }
            }

            // Maniac (Sadist Limit): dealing/taking/blocking damage fills the sadism gauge (1d50 + amount).
            if (attacker.fightingStyle === 'Maniac' && result.damage > 0) this.gainSadism(attacker, result.damage);
            if (defender.fightingStyle === 'Maniac') {
                if (result.damage > 0) this.gainSadism(defender, result.damage);
                if (blockedDamage > 0) this.gainSadism(defender, blockedDamage);
            }

            // Kamehameha: a hit while charging can break the charge (CON save vs 16+DMG/2).
            if (defender.kamehamehaCharging) {
                const saveDc = 16 + Math.floor(result.damage / 2);
                const save = this.modRoll(this.getEffectiveModifier(defender, 'con'));
                if (save < saveDc) {
                    defender.kamehamehaCharging = false;
                    defender.kamehamehaCharge = 0;
                    result.kamehamehaBroken = true;
                }
            }

            // Crane's Marking Strike: a Crane's ki technique marks the opponent for 1d5 turns,
            // creating openings in their defense. Multi-hit attacks roll the duration once.
            if (attacker.fightingStyle === 'Crane' && attackerStyleActive && attackType === 'ki' && result.hit && !defender.isIncapacitated) {
                const markTurns = this.rollDice(5);
                if (markTurns > (defender.craneMarkTurns || 0)) {
                    defender.craneMarkTurns = markTurns;
                    defender.craneMarkBy = attacker.userId;
                    result.craneMark = markTurns;
                }
            }

            // Swordsman: critical STR attacks cause Bleed.
            // Saibamen (Sharp Claws): all critical attacks apply Bleed for 1 turn.
            if (result.critical) {
                let bleedTurns = (attacker.fightingStyle === 'Swordsman' && attackerStyleActive) ? this.rollDice(2) : 0;
                if (this.hasSharpClaws(attacker)) {
                    bleedTurns = Math.max(bleedTurns, 1);
                }
                if (bleedTurns > 0) {
                    defender.bleedTurns = (defender.bleedTurns || 0) + bleedTurns;
                    result.bleed = bleedTurns;
                }
                // Puncture Wounds (Legionary Discipline): critical STR polearm strikes cause 1d3 turns of Bleed.
                if (attacker.fightingStyle === 'Legionary Discipline' && attackerStyleActive && isPolearmWeapon(attacker.weaponType) && attackType === 'physical') {
                    const pw = this.rollDice(3);
                    defender.bleedTurns = (defender.bleedTurns || 0) + pw;
                    result.bleed = (result.bleed || 0) + pw;
                }
                // Konatsian "Feinting Strike": a critical sword strike sets up advantage next attack.
                if (attacker.race === 'Konatsian' && isSwordWeapon(attacker.weaponType)) {
                    attacker.konatsianFeint = true;
                    result.feint = true;
                }
            }

            // Spiked Gloves: the attack causes bleed (1 turn) on any successful hit.
            if (attackType === 'physical' && result.hit && attacker.weaponBleedOnHit && !defender.isIncapacitated) {
                const spikedBleed = attacker.weaponBleedOnHit;
                defender.bleedTurns = (defender.bleedTurns || 0) + spikedBleed;
                result.bleed = (result.bleed || 0) + spikedBleed;
            }

            // Check for limb break/removal. This used to require a critical hit (or a perfect damage
            // roll), which made injuries far rarer than the intended band once damage dice and stat
            // mods balloon with power — every landed hit now rolls for a break, so the injury rate
            // is just `limbBreak.chancePct` (~10-15%, shifted by passives like Sharp Claws).
            if (result.damage > 0) {
                result.limbBreakAttempt = await this.attemptLimbBreak(attacker, defender, attackType);
            }

            // Check if defender is knocked out
            if (defender.currentHP <= 0) {
                // Maniac (Combat Addicted): at 0 HP, roll 1d20 + (sadism/2) to hang on, consuming sadism (2x/battle).
                if (this.checkCombatAddicted(defender)) {
                    result.combatAddicted = true;
                } else {
                    defender.isIncapacitated = true;
                    result.knockedOut = true;
                }
            }

            // Wings of the Tempest (Taekwondo): two consecutive kick hits grant a free third strike.
            // The free third strike itself does NOT count toward the next streak (counter stays 0).
            if (attacker.fightingStyle === 'Taekwondo' && attackType === 'physical' && result.hit && !freeStrike) {
                attacker.taekwondoKickStreak = (attacker.taekwondoKickStreak || 0) + 1;
                if (attacker.taekwondoKickStreak >= 2) {
                    result.tempestStrike = true;
                    attacker.tempestQueued = true;
                    attacker.taekwondoKickStreak = 0;
                }
            } else if (attacker.fightingStyle === 'Taekwondo') {
                attacker.taekwondoKickStreak = 0; // a missed kick breaks the streak
            }

            // Battlefield Control (Legionary Discipline): a polearm hit imposes Off-Balance (3 charges).
            if (attacker.fightingStyle === 'Legionary Discipline' && isPolearmWeapon(attacker.weaponType) && result.hit && !result.blocked && (attacker.polearmCharges || 0) > 0) {
                attacker.polearmCharges--;
                defender.offBalance = true;
                result.battlefieldControl = true;
            }
        }

        // Mark action as used
        if (isAction) {
            attacker.hasActed = true;
        } else {
            attacker.hasBonusActed = true;
        }
        // Attacking breaks invisibility, and (Shogun) ends Honor Guard Stance.
        attacker.invisible = false;
        if (attacker.fightingStyle === 'Shogun') attacker.honorGuard = false;

        // Zanshin (Karate): after attacking, your next defense roll is at disadvantage (once / 5 turns).
        if (attacker.fightingStyle === 'Karate' && (attacker.zanshinCooldown || 0) <= 0) {
            attacker.nextDefenseDisadvantage = true;
            attacker.zanshinCooldown = 5;
            result.zanshin = true;
        }

        // Fearless Strikes (Tiger) / Wings of the Tempest (Taekwondo): refund the action once.
        if (result.tigerExtraAction || result.tempestStrike) {
            attacker.hasActed = false;
        }

        // Clear disadvantage after turn
        if (!attacker.hasActed && !attacker.hasBonusActed) {
            attacker.turnDisadvantage = false;
        }

        this.battleLog.push({
            round: this.round,
            attacker: attacker.username,
            defender: defender.username,
            type: 'attack',
            result
        });

        return result;
    }

    // Enforce a single "grapple" relationship: a grappler holds at most ONE victim, and a victim
    // is held by at most ONE grappler. Releases any previous links before forming the new one.
    setGrapple(grappler, victim) {
        if (!grappler || !victim) return;
        // Release the grappler's previous victim.
        if (grappler.grappling) {
            const prev = this.turnOrder.find(p => p.userId === grappler.grappling);
            if (prev) prev.grappledBy = null;
            grappler.grappling = null;
        }
        // Release the victim's previous grappler.
        if (victim.grappledBy) {
            const prevGrappler = this.turnOrder.find(p => p.userId === victim.grappledBy);
            if (prevGrappler) prevGrappler.grappling = null;
        }
        victim.grappledBy = grappler.userId;
        victim.grappleEscapeCount = 0;
        grappler.grappling = victim.userId;
    }

    // Damage roll for a dodge reaction's counter/take-hit (mirrors the main hit pipeline).
    _reactionDamage(attacker, defender, attackType) {
        const dice = this.getStrDice(attackType === 'physical' ? attacker.stats.str : attacker.stats.wil);
        let dmg = this.rollDice(dice);
        dmg += this.getDamageMod(attacker, attackType);
        if (attacker.kiAppDamage) dmg += attacker.kiAppDamage;
        if (attacker.fightingStyle === 'Tiger' && styleAllowsWeapon(attacker.fightingStyle, attacker)) dmg += 5 + Math.round(this.getEffectiveModifier(attacker, 'str') * 0.25);
        if (defender.fightingStyle === 'Wrestler' && styleAllowsWeapon(defender.fightingStyle, defender)) dmg -= this.rollDice(3) + Math.floor(this.getEffectiveModifier(defender, 'con') / 2);
        return Math.max(dmg, 0);
    }

    // Apply an optional dodge reaction (used for NPC/companion auto-resolution and the player's
    // "use" confirmation). Returns a log string.
    _applyDodgeReaction(defender, attacker, reaction, opts) {
        if (reaction === 'spiritTiger') {
            const damage = this._reactionDamage(attacker, defender, opts.attackType);
            defender.currentHP = Math.max(0, (defender.currentHP || 0) - damage);
            if (defender.currentHP <= 0 && !defender.isIncapacitated) defender.isIncapacitated = true;
            const dc = this.modRoll(this.getEffectiveModifier(defender, 'spi'));
            const save = this.modRoll(this.getEffectiveModifier(attacker, 'wil'));
            const frighten = save < dc;
            if (frighten && attacker.mutation !== 'Hunter of Legend' && !this.isMindImmune(attacker)) attacker.frightenedTurns = 1;
            return `🐯 **Spirit of the Tiger!** **${defender.username}** takes the hit for **${damage} damage**... and forces a WIL save (${save} vs ${dc}) — ${frighten && attacker.mutation !== 'Hunter of Legend' ? `**${attacker.username}** is FRIGHTENED for 1 turn!` : `${attacker.username} resists!`}`;
        }
        if (reaction === 'groundGlider') {
            const maxKi = defender.ki || 0;
            const kiCost = Math.max(1, Math.round(maxKi * 0.03));
            if ((defender.currentKi || 0) >= kiCost) {
                defender.currentKi -= kiCost;
                const ggAtk = this.modRoll(this.getEffectiveModifier(defender, 'dex'));
                const ggDice = this.modDice(this.getEffectiveModifier(attacker, 'dex'));
                const ggDefA = this.rollDice(ggDice);
                const ggDefB = this.rollDice(ggDice);
                const ggDef = Math.min(ggDefA, ggDefB) + this.getEffectiveModifier(attacker, 'dex');
                if (ggAtk > ggDef) {
                    this.setGrapple(defender, attacker);
                    return `🤼 **Ground Glider!** **${defender.username}** spends **${kiCost} Ki** and **GRAPPLES** **${attacker.username}**!`;
                }
                return `🤼 **${defender.username}**'s **Ground Glider** slips (${ggAtk} vs ${ggDef})!`;
            }
            return `🤼 **${defender.username}** lacks the Ki to **Ground Glider**!`;
        }
        if (reaction === 'decisiveStrikes') {
            const kiCost = 5;
            if ((defender.currentKi || 0) < kiCost) {
                return `🥊 **${defender.username}** needs **${kiCost} Ki** for **Decisive Strikes**!`;
            }
            defender.currentKi -= kiCost;
            const oppDexMod = this.getEffectiveModifier(attacker, 'dex');
            const saveDice = opts.criticalFail ? 20 : 15;
            const save = this.rollDice(saveDice) + oppDexMod;
            const dc = 15 + this.getEffectiveModifier(defender, 'dex');
            if (save < dc) {
                const dice = this.getStrDice(defender.stats.str);
                const rawRoll = this.rollDice(dice);
                let dmg = rawRoll + Math.floor(this.getEffectiveModifier(defender, 'str') / 2);
                // Critical success: explode the dice (reroll without modifiers).
                if (rawRoll === dice) dmg += this.rollDice(dice);
                attacker.currentHP = Math.max(0, (attacker.currentHP || 0) - dmg);
                if (attacker.currentHP <= 0 && !attacker.isIncapacitated) attacker.isIncapacitated = true;
                defender.rhythmStacks = (defender.rhythmStacks || 0) + 1;
                return `🥊 **Decisive Strikes!** **${defender.username}** spends **${kiCost} Ki** and cracks **${attacker.username}** for **${dmg} damage** (+1 Rhythm)!`;
            }
            return `🥊 **${defender.username}**'s **Decisive Strikes** is evaded (${save} vs ${dc})!`;
        }
        return '';
    }

    // Resolve a player's pending dodge reaction ("use" = yes, false = no).
    resolveDodgeReaction(pending, use) {
        const defender = this.turnOrder.find(p => p.userId === pending.defenderUserId);
        const attacker = this.turnOrder.find(p => p.userId === pending.attackerId);
        if (!defender || !attacker) return '';
        defender.pendingReaction = null;
        if (!use) return '';
        return this._applyDodgeReaction(defender, attacker, pending.type, { attackType: pending.attackType, criticalFail: pending.criticalFail });
    }

    // Grapple attempt (action): d20+DEX vs d20+STR; success applies the Grappled status.
    // `opts.grappleBonus` adds a flat mod to the attempt (Namekian Flexible: +4 for 8 Ki).
    grapple(attackerId, defenderId, opts = {}) {
        const attacker = this.turnOrder.find(p => p.userId === attackerId);
        const defender = this.turnOrder.find(p => p.userId === defenderId);
        const grappleBonus = opts.grappleBonus || 0;

        if (!attacker || !defender) {
            return { success: false, message: 'Invalid attacker or defender!' };
        }
        if (attacker.hasActed) {
            return { success: false, message: 'You have already used your action!' };
        }
        // A Wrestler that already holds a victim stays locked on them — no multi-grappling.
        if (attacker.grappling) {
            const held = this.turnOrder.find(p => p.userId === attacker.grappling);
            return { success: false, message: `${attacker.username} already holds ${held ? held.username : 'a victim'} in a grapple!` };
        }
        if (defender.grappledBy) {
            return { success: false, message: `${defender.username} is already grappled!` };
        }
        // Yokai (Ghastly Structure): an intangible form cannot be grappled.
        if (defender.ghastlyActive && !defender.ghastlyExposed) {
            return { success: false, intangible: true, message: `${defender.username}'s **Ghastly Structure** makes them intangible — you cannot grab hold of a ghost!` };
        }

        const atkDexMod = this.getEffectiveModifier(attacker, 'dex');
        const defStrMod = this.getEffectiveModifier(defender, 'str');

        // Sprawl: non-wrestlers grapple a Wrestler with disadvantage (unless the grappler is also a Wrestler,
        // or a Legionary armed with a polearm — Grappling Proficiency).
        const sprawl = defender.fightingStyle === 'Wrestler' && attacker.fightingStyle !== 'Wrestler'
            && !(attacker.fightingStyle === 'Legionary Discipline' && isPolearmWeapon(attacker.weaponType));
        const atkDiceSize = this.modDice(atkDexMod);
        const atkRoll = this.rollDice(atkDiceSize);
        const atkRoll2 = sprawl ? this.rollDice(atkDiceSize) : null;
        const atkBase = sprawl ? Math.min(atkRoll, atkRoll2) : atkRoll;
        // Grapple Mastery: a Wrestler gains advantage on grapple attempts vs an Off-Balance opponent.
        const atkRoll3 = attacker.fightingStyle === 'Wrestler' && defender.offBalance ? this.rollDice(atkDiceSize) : null;
        const atk = Math.max(atkBase, atkRoll3 || 0) + atkDexMod + grappleBonus;
        const def = this.modRoll(defStrMod);

        attacker.hasActed = true;

        if (atk > def) {
            this.setGrapple(attacker, defender);
            return { success: true, failed: false, atk, def, attacker: attacker.username, defender: defender.username };
        }
        // Sprawl: a failed grapple against a Wrestler lets them counter-grapple the grappler —
        // but only if they aren't already holding someone (stay locked until the grapple breaks).
        if (sprawl && !defender.grappling) {
            this.setGrapple(defender, attacker);
            return { success: true, failed: true, sprawlCounter: true, atk, def, attacker: defender.username, defender: attacker.username };
        }
        return { success: true, failed: true, atk, def, attacker: attacker.username, defender: defender.username };
    }

    // Attempt to break/remove a limb
    async attemptLimbBreak(attacker, defender, attackType, targetLimb = null) {
        // Majins are immune to all injuries (Trello "Injury" card).
        if (defender.race === 'Majin') {
            return { success: false, message: 'Majins are immune to injuries.' };
        }
        // Non-lethal fights (spars, mentor training) never injure anyone — the same fights the
        // engine already skips limit breaks in. Injuries fire on EVERY landed hit now, so a spar
        // would otherwise maim or decapitate a training partner.
        if (this.isSpar || this.isCompanionSpar || this.isMentor) {
            return { success: false, message: 'no injuries in a non-lethal fight' };
        }

        // Pick the body part that takes the injury. Arms/legs (one of each pair) are more
        // likely than a single rib cage or the head, per the Trello "Injury" card.
        const limbPool = ['arm', 'arm', 'leg', 'leg', 'ribs', 'head'];
        const limb = targetLimb && limbPool.includes(targetLimb)
            ? targetLimb
            : limbPool[this.rollDice(limbPool.length) - 1];

        const statMod = attackType === 'physical'
            ? this.getEffectiveModifier(attacker, 'str')
            : this.getEffectiveModifier(attacker, 'wil');

        const conMod = this.getEffectiveModifier(defender, 'con');

        // Both sides roll the SAME die size (scaled by their OWN modifier) and add their own
        // modifier, so the contest depends only on the STR-vs-CON gap instead of on how large the
        // milestone dice have grown.
        const statDiceSize = this.modDice(statMod, 20);
        const saveDiceSize = this.modDice(conMod, 20);
        const attackRoll = this.rollDice(statDiceSize) + statMod;
        let saveRoll = this.rollDice(saveDiceSize) + conMod;
        // Fatigue (Trello "Fatigue" card): 80%+ fatigue = disadvantage on CON saving throws.
        if ((defender.currentFatigue || 0) >= 80) {
            saveRoll = Math.min(saveRoll, this.rollDice(saveDiceSize) + conMod);
        }

        // Break chance -> margin. For two i.i.d. uniform dice of size D, P(a - b > m·D) = (1-m)²/2,
        // so inverting that turns the configured chance into a margin that scales WITH the dice.
        let chance = LIMB_BREAK_CHANCE_PCT / 100;
        if (limb === 'head') chance += LIMB_BREAK_HEAD_PCT / 100;      // a small, hard target
        if (defender.blocked) chance += LIMB_BREAK_BLOCKED_PCT / 100;  // braced against the blow
        // Saibamen (Sharp Claws): barehanded blows tear limbs more easily.
        if (this.hasSharpClaws(attacker) && attackType === 'physical' && !attacker.weapon) {
            chance += LIMB_BREAK_CLAWS_PCT / 100;
        }
        chance = Math.max(0.01, Math.min(0.9, chance));
        const scaleDie = Math.max(2, Math.round((statDiceSize + saveDiceSize) / 2));
        const margin = Math.round(scaleDie * (1 - Math.sqrt(2 * chance)));

        if (attackRoll <= saveRoll + margin) {
            return { success: false, attackRoll, saveRoll, chance };
        }

        // A slashing weapon (or a slash attack) severs the limb; otherwise it's broken.
        const slashing = attackType === 'slash' || (attacker.weaponType && isSwordWeapon(attacker.weaponType));
        const limbType = slashing ? 'sliced off' : 'broken';
        defender.brokenLimbs.push({ limb, type: limbType });

        const effects = [];
        if (limb === 'arm' || limb === 'leg') {
            // Slicing an arm/leg also causes Bleed (Trello "Injury" card).
            if (slashing) {
                const bleedTurns = this.rollDice(limb === 'arm' ? 6 : 8) + 2;
                defender.bleedTurns = (defender.bleedTurns || 0) + bleedTurns;
                effects.push(`🩸 bleeds for ${bleedTurns} turns`);
            }
        } else if (limb === 'ribs') {
            effects.push('−3 CON mod');
        } else if (limb === 'head') {
            // Head injury: concussed — injury penalties plus the Concussion status.
            defender.concussed = true;
            defender.currentHP = Math.max(0, (defender.currentHP || 0) - 3);
            effects.push('🧠 concussed (−3 HP, −3 STR/DEX)');
            // A severed head means instant death (never for Bio-Androids).
            if (slashing && defender.race !== 'Bio-Android') {
                defender.isDead = true;
                defender.isIncapacitated = true;
                defender.currentHP = 0;
                effects.push('💀 decapitated!');
            }
        }

        return {
            success: true,
            limb,
            type: limbType,
            effects: effects.join(', '),
            attackRoll,
            saveRoll
        };
    }

    // Death saving throw
    deathSave(participantId) {
        const participant = this.turnOrder.find(p => p.userId === participantId);
        
        if (!participant || !participant.isIncapacitated) {
            return { success: false, message: 'Participant is not incapacitated!' };
        }

        const conEdge = Math.max(0, Math.min(5, Math.round(this.getEffectiveModifier(participant, 'con') / 10)));
        const saveDice = 20;
        let roll = this.rollDice(saveDice) + conEdge + this.conSaveBonus(participant);
        // Fatigue (Trello "Fatigue" card): 80%+ fatigue = disadvantage on CON saving throws
        if ((participant.currentFatigue || 0) >= 80) {
            roll = Math.min(roll, this.rollDice(saveDice) + conEdge + this.conSaveBonus(participant));
        }
        const success = roll > DEATH_SAVE_DC;

        if (success) {
            participant.succeededDeathSaves++;
            if (participant.succeededDeathSaves >= 2) {
                participant.isIncapacitated = true; // Stays incapacitated but stable
                return { success: true, roll, stable: true };
            }
        } else {
            participant.failedDeathSaves++;
            if (participant.failedDeathSaves >= 3) {
                participant.isDead = true;
                this.battleLog.push({
                    round: this.round,
                    participant: participant.username,
                    type: 'death'
                });
                return { success: false, roll, dead: true };
            }
        }

        return { success, roll, failedSaves: participant.failedDeathSaves, succeededSaves: participant.succeededDeathSaves };
    }

    // Attempt retreat
    attemptRetreat(participantId, opponentId) {
        const participant = this.turnOrder.find(p => p.userId === participantId);
        const opponent = this.turnOrder.find(p => p.userId === opponentId);

        if (!participant || !opponent) {
            return { success: false, message: 'Invalid participants!' };
        }

        // Grappled characters cannot retreat (Trello "Grapple" card) — they lose their turn.
        if (participant.grappledBy) {
            participant.hasActed = true;
            participant.hasBonusActed = true;
            participant.turnDisadvantage = true;
            return { success: false, escaped: false, grappled: true, participantRoll: 0, requiredRoll: 0 };
        }

        // Retreating is a DEX contest: BOTH sides roll a DEX-scaled die and add their own DEX mod,
        // so fleeing is a fair fight at every power level (a flat d20 against the chaser's whole
        // DEX modifier made retreating impossible once modifiers grew).
        const participantDexMod = this.getEffectiveModifier(participant, 'dex');
        let participantRoll = this.modRoll(participantDexMod) + (participant.flyRetreatBonus || 0); // Fly mastery 4: +3 retreat
        // Pacifist (Wise Old One) persuade debuff: the affected fighter is worse at retreat/chase.
        participantRoll -= (participant.retreatChasePenalty || 0);
        // Prowling Fury (Tiger): the opponent loses 25% on their retreat rolls when fleeing from a Tiger.
        if (opponent.fightingStyle === 'Tiger') {
            participantRoll -= Math.round(participantRoll * 0.25);
        }
        const opponentDexMod = this.getEffectiveModifier(opponent, 'dex');

        // A Pacifist-persuaded opponent chases poorly, making it easier for you to flee from them.
        const requiredRoll = this.modRoll(opponentDexMod) - (opponent.retreatChasePenalty || 0);

        if (participantRoll >= requiredRoll) {
            return {
                success: true,
                escaped: true,
                participantRoll,
                requiredRoll
            };
        } else {
            // Failed retreat - lose turn and gain disadvantage
            participant.hasActed = true;
            participant.hasBonusActed = true;
            participant.turnDisadvantage = true;

            return {
                success: false,
                escaped: false,
                participantRoll,
                requiredRoll
            };
        }
    }

    // Save an incapacitated ally
    saveAlly(saverId, targetId) {
        const saver = this.turnOrder.find(p => p.userId === saverId);
        const target = this.turnOrder.find(p => p.userId === targetId);

        if (!saver || !target) {
            return { success: false, message: 'Invalid participants!' };
        }

        if (!target.isIncapacitated) {
            return { success: false, message: 'Target is not incapacitated!' };
        }

        if (saver.hasActed) {
            return { success: false, message: 'You have already used your action!' };
        }

        // Auto-succeed one death save
        target.succeededDeathSaves++;
        saver.hasActed = true;

        if (target.succeededDeathSaves >= 2) {
            target.isIncapacitated = true; // Stable
            return { success: true, stable: true };
        }

        return { success: true, stable: false };
    }

    // Attack incapacitated target
    attackIncapacitated(attackerId, targetId) {
        const attacker = this.turnOrder.find(p => p.userId === attackerId);
        const target = this.turnOrder.find(p => p.userId === targetId);

        if (!attacker || !target) {
            return { success: false, message: 'Invalid participants!' };
        }

        if (!target.isIncapacitated) {
            return { success: false, message: 'Target is not incapacitated!' };
        }

        // Guaranteed hit
        const conMod = this.getEffectiveModifier(target, 'con');
        const saveRoll = this.rollDice(20) + conMod;

        if (saveRoll < 15) {
            target.failedDeathSaves++;
            
            if (target.failedDeathSaves >= 3) {
                target.isDead = true;
                return { success: true, saveRoll, dead: true };
            }
            
            return { success: true, saveRoll, failedSave: true };
        }

        return { success: true, saveRoll, saved: true };
    }

    // Check if battle is over (team-aware: players vs NPCs)
    isBattleOver() {
        // Canon-intervene battle: the villain is a REAL (player-controlled) participant who fights
        // on the opposing side from the interveners and their allied NPC helpers. The generic
        // player/NPC split can't see that, so decide it explicitly:
        //   - villain down  -> the resistance wins
        //   - all heroes down -> the villain wins
        if (this.canonInterveneBattle) {
            const villain = this.turnOrder.find(p => p.isCanonVillain);
            if (!villain || villain.isDead || villain.isIncapacitated) return true;
            const heroesLeft = this.turnOrder.some(p => !p.isCanonVillain && !p.isDead && !p.isIncapacitated);
            return !heroesLeft;
        }

        const players = this.turnOrder.filter(p => !this.isNPC(p) && !p.isDead && !p.isIncapacitated);
        const npcs = this.turnOrder.filter(p => this.isNPC(p) && !p.isDead && !p.isIncapacitated);
        const totalNPCs = this.turnOrder.filter(p => this.isNPC(p));
        const hasAllies = this.turnOrder.some(p => p.isAlly === true || p.recruited === true);

        // All players (and recruited allies/companions) are down -> battle over (enemies win, or mutual defeat)
        if (players.length === 0) return true;

        // Genuine PvP (no NPCs at all, and no recruited allies/companions): last one standing wins.
        // (A mission where every enemy was recruited still has allies but no NPCs — that's a PvE win.)
        if (totalNPCs.length === 0 && !hasAllies) return players.length <= 1;

        // PvE: all enemies defeated -> players win
        return npcs.length === 0;
    }

    // Get battle status
    getStatus() {
        return {
            round: this.round,
            currentTurn: this.getCurrentTurn(),
            participants: this.turnOrder.map(p => ({
                username: p.username,
                userId: p.userId,
                race: p.race || null,
                hp: p.currentHP,
                ki: p.currentKi,
                fatigue: p.currentFatigue,
                isIncapacitated: p.isIncapacitated,
                isDead: p.isDead,
                brokenLimbs: p.brokenLimbs,
                hasActed: p.hasActed,
                hasBonusActed: p.hasBonusActed
            })),
            isOver: this.isBattleOver()
        };
    }
}

module.exports = { Battle };
