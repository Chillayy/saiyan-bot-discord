const fs = require('fs');
const path = require('path');
const { createSaver } = require('./saver');

class CharacterManager {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.charactersFile = path.join(this.dataDir, 'characters.json');
        this.ensureDataDir();
        this.characters = this.loadCharacters();
        // Fatigue soft floor: without a Rest, fatigue can't be reduced below peak * ratio.
        this.fatigueFloorRatio = 0.3;
        // PERF: persistence is debounced and non-blocking. saveCharacters() used to run
        // JSON.stringify + fs.writeFileSync on EVERY mutation (HP ticks, item moves, family
        // ticks...), which froze the event loop and delayed every player's interaction.
        // Now mutations only mark dirty; the actual write coalesces to at most one flush
        // per window. Game logic and the JSON shape are unchanged.
        this._saver = createSaver(this.charactersFile, () => this.characters, { label: 'characters.json' });
        // Optional hook (set by index.js): fired whenever a character's powerLevel may have
        // changed so the auto-saga cache can invalidate itself without a full rescan.
        this.onPLChanged = null;
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

    // Mark dirty and schedule a coalesced background write (non-blocking).
    saveCharacters() {
        this._saver.save();
        return true;
    }

    // Critical-path immediate persist (e.g. character create/delete): still coalesces
    // concurrent calls into one write, but flushes right away instead of waiting.
    saveCharactersNow() {
        this._saver.saveNow();
        return true;
    }

    // Awaitable flush (used by batch migrations and shutdown paths).
    flushCharacters() {
        return this._saver.flush();
    }

    createCharacter(userId, characterData) {
        if (!this.characters[userId]) {
            this.characters[userId] = [];
        }

        const character = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...characterData,
            age: characterData.age !== undefined ? characterData.age : 18,
            currentHP: characterData.maxHP,
            currentKi: characterData.maxKi,
            fatigue: 0,
            peakFatigue: 0,
            inventory: [],
            inventorySlots: 10, // Default inventory slots
            fishTackle: [], // Fishing Tackle stores fish here (0 inventory slots)
            huntingBag: [], // Hunting Bag stores meat here (up to 250 items)
            statusEffects: [],
            techniques: characterData.techniques || [],
            transformations: [],
            mutations: characterData.mutation || 'None',
            homeLocation: null,
            homeSpace: null,
            homeType: null,
            homeStorage: [],
            homeStorageSlots: 0,
            weapon: null,
            armor: null,
            weaponAttackMod: 0,
            weaponDamageMode: null,
            weaponBypass: false,
            weaponDexPenalty: 0,
            armorReduction: 0,
            armorDexReduction: 0,
            armorDurability: 0
        };

        this.characters[userId].push(character);
        // Character creation can raise the server's max power level (auto-saga) — invalidate cache.
        if (this.onPLChanged) this.onPLChanged();
        this.saveCharactersNow(); // creations are rare — persist immediately, not on the debounce window
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

        // Auto-saga cache hook: fire when the mutation could change the strongest LIVING power
        // level. `dead` matters as much as `powerLevel` — getServerMaxPL() ignores dead characters,
        // so the top player dying (or being revived) must drop/raise the derived saga too. Without
        // this the saga stayed pinned to a wiped player's power level forever.
        if (this.onPLChanged && updates
            && (Object.prototype.hasOwnProperty.call(updates, 'powerLevel')
                || Object.prototype.hasOwnProperty.call(updates, 'dead'))) {
            this.onPLChanged();
        }

        this.saveCharacters();
        return this.characters[userId][index];
    }

    deleteCharacter(userId, characterId) {
        if (!this.characters[userId]) return false;

        const index = this.characters[userId].findIndex(c => c.id === characterId);
        if (index === -1) return false;

        this.characters[userId].splice(index, 1);
        // Deleting a character can remove the server's strongest player (auto-saga) — invalidate cache.
        if (this.onPLChanged) this.onPLChanged();
        this.saveCharactersNow(); // destructive — persist immediately
        return true;
    }

    // Wipe ALL of a user's characters (admin). Returns how many were removed.
    deleteAllCharacters(userId) {
        if (!this.characters[userId] || this.characters[userId].length === 0) return 0;
        const count = this.characters[userId].length;
        delete this.characters[userId];
        if (this.onPLChanged) this.onPLChanged();
        this.saveCharactersNow(); // destructive — persist immediately
        return count;
    }

    modifyHP(userId, characterId, amount) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.currentHP = Math.max(0, Math.min(character.maxHP || Infinity, (character.currentHP || 0) + amount));
        this.updateCharacter(userId, characterId, { currentHP: character.currentHP });
        return character;
    }

    modifyKi(userId, characterId, amount) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        character.currentKi = Math.max(0, Math.min(character.maxKi || Infinity, (character.currentKi || 0) + amount));
        this.updateCharacter(userId, characterId, { currentKi: character.currentKi });
        return character;
    }

    // Fatigue soft floor (Trello "Fatigue" card): the persistent stored training fatigue can't
    // be reduced below peak * ratio without a Rest (the missing-Ki fatigue self-resolves, so the
    // floor is applied to the stored value that items/food actually reduce).
    modifyFatigue(userId, characterId, amount, options = {}) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;
        if (typeof character.peakFatigue !== 'number') character.peakFatigue = 0;
        const ratio = options.floorRatio ?? this.fatigueFloorRatio ?? 0.3;

        let newFatigue = Math.max(0, Math.min(100, (character.fatigue || 0) + amount));

        if (options.full) {
            // A genuine Rest: bypass the soft floor and reset the fatigue peak.
            character.peakFatigue = 0;
        } else {
            if (amount < 0) {
                // Can't reduce stored fatigue below peak * floor_ratio without Rest.
                const floor = character.peakFatigue * ratio;
                newFatigue = Math.max(newFatigue, floor);
            }
            if (newFatigue > character.peakFatigue) character.peakFatigue = newFatigue;
        }

        character.fatigue = newFatigue;
        this.updateCharacter(userId, characterId, { fatigue: character.fatigue, peakFatigue: character.peakFatigue });
        return character;
    }

    addItem(userId, characterId, item) {
        const character = this.getCharacter(userId, characterId);
        if (!character) return null;

        // Durable tools are stored as objects with current/max durability (and never stack).
        if (typeof item === 'string') {
            const parsedName = parseItemName(item).name;
            const durable = DURABLE_ITEMS[parsedName];
            if (durable) {
                const maxSlots = character.inventorySlots || 10;
                if (character.inventory.length >= maxSlots) {
                    return { success: false, message: `Inventory full! (${maxSlots}/${maxSlots} slots)` };
                }
                const obj = { name: parsedName, durability: durable.max, maxDurability: durable.max };
                character.inventory.push(obj);
                this.updateCharacter(userId, characterId, { inventory: character.inventory });
                return { success: true, character };
            }
        }

        // Stack plain-string items (components, materials, consumables) into one slot ("Nx Name").
        if (typeof item === 'string') {
            const parsed = parseItemName(item);
            const baseName = parsed.name;
            const idx = character.inventory.findIndex(existing => {
                if (typeof existing !== 'string') return false;
                return parseItemName(existing).name.toLowerCase() === baseName.toLowerCase();
            });
            if (idx !== -1) {
                const existingQty = parseItemName(character.inventory[idx]).quantity;
                character.inventory[idx] = formatStackedItem(baseName, existingQty + parsed.quantity);
                this.updateCharacter(userId, characterId, { inventory: character.inventory });
                return { success: true, character };
            }
        }

        // Check inventory limit
        const maxSlots = character.inventorySlots || 10;
        if (character.inventory.length >= maxSlots) {
            return { success: false, message: `Inventory full! (${maxSlots}/${maxSlots} slots)` };
        }

        character.inventory.push(item);
        this.updateCharacter(userId, characterId, { inventory: character.inventory });
        return { success: true, character: character };
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
        const { str, dex, con, wil, spi, maxHP, maxKi } = stats;
        return Math.floor(
            (str * 1.5) +
            (wil * 1.5) +
            (spi) +
            (con * 0.75) +
            (spi * 0.75) +
            (dex * 0.7) +
            (maxHP / 10) +
            (maxKi / 10) +
            0.5
        ) + 1;
    }
}

// Durable tools granted at full durability (Trello durability limits).
const DURABLE_ITEMS = {
    'Fishing Rod': { max: 3 },
    'Welding Torch': { max: 5 },
    'Skinning Knife': { max: 20 }
};

// Parse an inventory entry into { name, quantity }. Handles the stacked "Nx Name" format.
function parseItemName(entry) {
    const raw = String(typeof entry === 'string' ? entry : (entry && (entry.name || entry)));
    const m = raw.match(/^(\d+)x\s+(.+)$/i);
    if (m) return { name: m[2].trim(), quantity: parseInt(m[1], 10) };
    return { name: raw.trim(), quantity: 1 };
}

// Render a stacked item name: "Name" for qty 1, "Nx Name" for qty > 1.
function formatStackedItem(name, quantity) {
    return quantity > 1 ? `${quantity}x ${name}` : name;
}

module.exports = { CharacterManager, parseItemName, formatStackedItem, DURABLE_ITEMS };
