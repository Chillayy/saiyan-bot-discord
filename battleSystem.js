// Battle System Module
class Battle {
    constructor(participants) {
        this.participants = participants; // Array of {userId, username, stats, hp, ki, fatigue}
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.round = 1;
        this.battleLog = [];
        this.active = true;
    }

    // Roll initiative (d50) for all participants
    rollInitiative() {
        const initiatives = this.participants.map(p => {
            const roll = this.rollDice(50);
            return {
                ...p,
                initiative: roll,
                currentHP: p.hp,
                currentKi: p.ki,
                currentFatigue: p.fatigue || 0,
                failedDeathSaves: 0,
                succeededDeathSaves: 0,
                isIncapacitated: false,
                isDead: false,
                brokenLimbs: [],
                hasActed: false,
                hasBonusActed: false,
                turnDisadvantage: false
            };
        });

        // Sort by initiative (highest first)
        this.turnOrder = initiatives.sort((a, b) => b.initiative - a.initiative);
        return this.turnOrder;
    }

    // Get current turn's participant
    getCurrentTurn() {
        return this.turnOrder[this.currentTurnIndex];
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
            });
        }

        const current = this.getCurrentTurn();
        
        // Check if current participant is dead or incapacitated
        if (current.isDead || current.isIncapacitated) {
            return this.nextTurn(); // Skip their turn
        }

        return current;
    }

    // Roll dice with variable sides
    rollDice(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    // Calculate modifier from stat
    getModifier(stat) {
        return Math.floor((stat - 10) / 2);
    }

    // Perform attack roll
    async attack(attackerId, defenderId, attackType = 'physical', isAction = true) {
        const attacker = this.turnOrder.find(p => p.userId === attackerId);
        const defender = this.turnOrder.find(p => p.userId === defenderId);

        if (!attacker || !defender) {
            return { success: false, message: 'Invalid attacker or defender!' };
        }

        // Check if action is available
        if (isAction && attacker.hasActed) {
            return { success: false, message: 'You have already used your action!' };
        }
        if (!isAction && attacker.hasBonusActed) {
            return { success: false, message: 'You have already used your bonus action!' };
        }

        const dexMod = this.getModifier(attacker.stats.dex);
        const defDexMod = this.getModifier(defender.stats.dex);

        // Initial attack roll
        let attackRoll = this.rollDice(20);
        let defenseRoll = this.rollDice(20);

        // Apply disadvantage if present
        if (attacker.turnDisadvantage) {
            const secondRoll = this.rollDice(20);
            attackRoll = Math.min(attackRoll, secondRoll);
        }

        const attackTotal = attackRoll + dexMod;
        const defenseTotal = defenseRoll + defDexMod;

        let result = {
            success: true,
            attackRoll,
            defenseRoll,
            attackTotal,
            defenseTotal,
            critical: attackRoll === 20,
            criticalFail: attackRoll === 1,
            defenderCritFail: defenseRoll === 1,
            hit: false,
            blocked: false,
            dodged: false,
            clash: false,
            damage: 0
        };

        // Determine if hit lands
        if (attackTotal > defenseTotal || result.defenderCritFail) {
            result.hit = true;
        } else if (attackTotal < defenseTotal || result.criticalFail) {
            // Block or dodge sequence
            let blockRoll = this.rollDice(20);
            let dodgeRoll = this.rollDice(20);

            // Modify rolls based on crits
            if (result.criticalFail) {
                blockRoll -= 5;
            }
            if (defenseRoll === 20) {
                dodgeRoll += 5;
            }

            const blockTotal = blockRoll + dexMod;
            const dodgeTotal = dodgeRoll + defDexMod;

            if (blockTotal > dodgeTotal) {
                result.blocked = true;
            } else if (dodgeTotal >= blockTotal) {
                result.dodged = true;
            }

            result.blockRoll = blockRoll;
            result.dodgeRoll = dodgeRoll;
        } else if (attackTotal === defenseTotal) {
            result.clash = true;
        }

        // Calculate damage if hit or blocked
        if (result.hit || result.blocked) {
            const statMod = attackType === 'physical' 
                ? this.getModifier(attacker.stats.str)
                : this.getModifier(attacker.stats.wil);

            let damageRoll = this.rollDice(5);
            let damage = damageRoll + statMod;

            // Critical hit bonus
            if (result.critical) {
                damage += 5;
            }

            // Block reduces damage by 80%
            if (result.blocked) {
                damage = Math.floor(damage * 0.2);
            }

            result.damage = Math.max(damage, 0);
            result.damageRoll = damageRoll;

            // Apply damage
            defender.currentHP -= result.damage;

            // Check for limb break/removal on max damage roll
            if (damageRoll === 5) {
                result.limbBreakAttempt = await this.attemptLimbBreak(attacker, defender, attackType);
            }

            // Check if defender is knocked out
            if (defender.currentHP <= 0) {
                defender.isIncapacitated = true;
                result.knockedOut = true;
            }
        }

        // Mark action as used
        if (isAction) {
            attacker.hasActed = true;
        } else {
            attacker.hasBonusActed = true;
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

    // Attempt to break/remove a limb
    async attemptLimbBreak(attacker, defender, attackType, targetLimb = 'body') {
        const statMod = attackType === 'physical'
            ? this.getModifier(attacker.stats.str)
            : this.getModifier(attacker.stats.wil);

        const conMod = this.getModifier(defender.stats.con);

        // Determine dice based on target
        const attackDice = targetLimb === 'head' ? 18 : 20;
        const attackRoll = this.rollDice(attackDice) + statMod;

        // Defender rolls constitution save (different based on if blocked)
        const saveDice = defender.blocked ? 35 : 25;
        const saveRoll = this.rollDice(saveDice) + conMod;

        if (attackRoll > saveRoll) {
            const limbType = attackType === 'slash' ? 'sliced off' : 'broken';
            defender.brokenLimbs.push({ limb: targetLimb, type: limbType });

            return {
                success: true,
                limb: targetLimb,
                type: limbType,
                attackRoll,
                saveRoll
            };
        }

        return {
            success: false,
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

        const roll = this.rollDice(20);
        const success = roll > 8;

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

        const participantRoll = this.rollDice(20);
        const opponentRoll = this.rollDice(20);
        const opponentDexMod = this.getModifier(opponent.stats.dex);
        
        const requiredRoll = opponentRoll + opponentDexMod;

        if (participantRoll >= requiredRoll) {
            const escapeArea = this.rollDice(1000);
            return {
                success: true,
                escaped: true,
                area: escapeArea,
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
        const conMod = this.getModifier(target.stats.con);
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

    // Check if battle is over
    isBattleOver() {
        const aliveCombatants = this.turnOrder.filter(p => !p.isDead && !p.isIncapacitated);
        return aliveCombatants.length <= 1;
    }

    // Get battle status
    getStatus() {
        return {
            round: this.round,
            currentTurn: this.getCurrentTurn(),
            participants: this.turnOrder.map(p => ({
                username: p.username,
                userId: p.userId,
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
