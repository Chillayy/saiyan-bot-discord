const fs = require('fs');
const path = require('path');

class CharacterManager {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.charactersFile = path.join(this.dataDir, 'characters.json');
        this.ensureDataDir();
        this.characters = this.loadCharacters();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.charactersFile)) {
            fs.writeFileSync(this.charactersFile, JSON.stringify({}, null, 2));
        }
    }

    loadCharacters() {
        try {
            const data = fs.readFileSync(this.charactersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading characters:', error);
            return {};
        }
    }

    saveCharacters() {
        try {
            fs.writeFileSync(this.charactersFile, JSON.stringify(this.characters, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving characters:', error);
            return false;
        }
    }

    createCharacter(userId, characterData) {
        if (!this.characters[userId]) {
            this.characters[userId] = [];
        }

        const character = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...characterData,
            currentHP: characterData.maxHP,
            currentKi: characterData.maxKi,
            fatigue: 0,
            inventory: [],
            statusEffects: [],
            techniques: [],
            transformations: [],
            mutations: characterData.mutation || 'None',
            experience: 0,
            level: 1
        };

        this.characters[userId].push(character);
        this.saveCharacters();
        return character;
    }

    getCharacter(userId, characterId = null) {
        if (!this.characters[userId] || this.characters[userId].length === 0) {
            return null;
        }

        if (characterId) {
            return this.characters[userId].find(c => c.id === characterId);
        }

        // Return first character if no ID specified
        return this.characters[userId][0];
    }

    getAllCharacters(userId) {
        return this.characters[userId] || [];
    }

    updateCharacter(userId, characterId, updates) {
        const characters = this.characters[userId];
        if (!characters) return false;

        const index = characters.findIndex(c => c.id === characterId);
        if (index === -1) return false;

        this.characters[userId][index] = {
            ...this.characters[userId][index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveCharacters();
        return this.characters[userId][index];
    }

    deleteCharacter(userId, characterId) {
        if (!this.characters[userId]) return false;

        const index = this.characters[userId].findIndex(c => c.id === characterId);
        if (index === -1) return false;

        this.characters[userId].splice(index, 1);
        this.saveCharacters();
        return true;
    }

    modifyHP(userId, characterId, amount) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.currentHP = Math.max(0, Math.min(character.maxHP, character.currentHP + amount));
        this.updateCharacter(userId, characterId, { currentHP: character.currentHP });
        return character;
    }

    modifyKi(userId, characterId, amount) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.currentKi = Math.max(0, Math.min(character.maxKi, character.currentKi + amount));
        this.updateCharacter(userId, characterId, { currentKi: character.currentKi });
        return character;
    }

    modifyFatigue(userId, characterId, amount) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.fatigue = Math.max(0, Math.min(100, character.fatigue + amount));
        this.updateCharacter(userId, characterId, { fatigue: character.fatigue });
        return character;
    }

    addItem(userId, characterId, item) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.inventory.push(item);
        this.updateCharacter(userId, characterId, { inventory: character.inventory });
        return character;
    }

    removeItem(userId, characterId, itemName) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        const index = character.inventory.findIndex(i => i.name === itemName || i === itemName);
        if (index !== -1) {
            character.inventory.splice(index, 1);
            this.updateCharacter(userId, characterId, { inventory: character.inventory });
        }
        return character;
    }

    addStatusEffect(userId, characterId, effect) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.statusEffects.push({
            ...effect,
            appliedAt: new Date().toISOString()
        });
        this.updateCharacter(userId, characterId, { statusEffects: character.statusEffects });
        return character;
    }

    removeStatusEffect(userId, characterId, effectName) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.statusEffects = character.statusEffects.filter(e => e.name !== effectName);
        this.updateCharacter(userId, characterId, { statusEffects: character.statusEffects });
        return character;
    }

    calculatePowerLevel(stats) {
        const { str, dex, con, wil, spi, int, maxHP, maxKi } = stats;
        return Math.floor(
            (str * 1.5) +
            (wil * 1.5) +
            (spi) +
            (con * 0.75) +
            (spi * 0.75) +
            (dex * 0.7) +
            (int * 0.5) +
            (maxHP / 10) +
            (maxKi / 10) +
            0.5
        ) + 1;
    }
}

module.exports = { CharacterManager };
