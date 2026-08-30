// Battle Manager - handles multiple concurrent, player-specific battles
class BattleManager {
    constructor() {
        this.battles = new Map(); // battleId -> Battle instance
        this.userBattles = new Map(); // userId -> battleId (each player is in at most one battle)
    }

    // Create a new battle in a channel (participants are registered to it)
    createBattle(channelId, participants) {
        const { Battle } = require('./battleSystem');
        const battle = new Battle(participants);
        const battleId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        battle.id = battleId;
        battle.channelId = channelId;
        this.battles.set(battleId, battle);
        participants.forEach(p => this.userBattles.set(p.userId, battleId));
        return battle;
    }

    // Get battle by id
    getBattle(battleId) {
        return this.battles.get(battleId);
    }

    // Get the battle a user is currently in
    getBattleForUser(userId) {
        const battleId = this.userBattles.get(userId);
        return battleId ? this.battles.get(battleId) : null;
    }

    // Check if a battle id exists
    hasBattle(battleId) {
        return this.battles.has(battleId);
    }

    // Check if a user is currently in a battle
    hasBattleForUser(userId) {
        return this.userBattles.has(userId);
    }

    // Add a player to an existing battle (used by /join-mission)
    addPlayerToBattle(battle, participant) {
        if (!battle || !this.battles.has(battle.id)) return false;
        if (this.userBattles.has(participant.userId)) return false;
        // Register and join the turn order
        this.userBattles.set(participant.userId, battle.id);
        battle.addParticipant(participant);
        return true;
    }

    // End battle by id, unregistering all its players
    endBattle(battleId) {
        const battle = this.battles.get(battleId);
        if (battle) {
            battle.turnOrder.forEach(p => {
                if (this.userBattles.get(p.userId) === battleId) {
                    this.userBattles.delete(p.userId);
                }
            });
        }
        return this.battles.delete(battleId);
    }

    // Get all active battles
    getActiveBattles() {
        return Array.from(this.battles.values());
    }
}

module.exports = { BattleManager };
