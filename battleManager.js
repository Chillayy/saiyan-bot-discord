// Battle Manager - handles multiple concurrent battles
class BattleManager {
    constructor() {
        this.battles = new Map(); // channelId -> Battle instance
    }

    // Create a new battle in a channel
    createBattle(channelId, participants) {
        const { Battle } = require('./battleSystem');
        const battle = new Battle(participants);
        this.battles.set(channelId, battle);
        return battle;
    }

    // Get battle for a channel
    getBattle(channelId) {
        return this.battles.get(channelId);
    }

    // Check if battle exists in channel
    hasBattle(channelId) {
        return this.battles.has(channelId);
    }

    // End battle in channel
    endBattle(channelId) {
        return this.battles.delete(channelId);
    }

    // Get all active battles
    getActiveBattles() {
        return Array.from(this.battles.entries());
    }
}

module.exports = { BattleManager };
