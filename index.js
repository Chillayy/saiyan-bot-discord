const {Client, Events, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder} = require("discord.js");
const {token} = require("./.gitignore/config.json");
const {BattleManager} = require("./battleManager");
const {CharacterManager} = require("./characterManager");
const {races} = require("./raceData");
const {getAvailableMutations, formatMutation} = require("./mutations");

const client = new Client({intents: [GatewayIntentBits.Guilds]});
const battleManager = new BattleManager();
const characterManager = new CharacterManager();

// Store pending character creation data for rerolls
const pendingCharacters = new Map();

// Track users currently in character creation to prevent bypass
const activeCreations = new Map();

// Calculate stat modifier: +1 per 20 up to 200, +1 per 200 up to 2000, +1 per 2000 up to 20000, etc.
function calculateModifier(stat) {
    let modifier = 0;
    let remaining = stat;
    
    // Tier system: each tier multiplies the threshold by 10
    // Tier 1: 0-200 (+1 per 20) = max +10
    // Tier 2: 201-2000 (+1 per 200) = max +9
    // Tier 3: 2001-20000 (+1 per 2000) = max +9
    // Tier 4: 20001-200000 (+1 per 20000) = max +9
    // And so on...
    
    let threshold = 20;
    let tierCap = 200;
    
    while (remaining > 0) {
        if (remaining <= tierCap) {
            // Within current tier
            modifier += Math.floor(remaining / threshold);
            remaining = 0;
        } else {
            // Complete current tier and move to next
            modifier += Math.floor(tierCap / threshold);
            remaining -= tierCap;
            
            // Next tier: multiply thresholds by 10
            threshold *= 10;
            tierCap *= 10;
        }
    }
    
    return modifier;
}

// Calculate all modifiers for a character
function calculateAllModifiers(stats) {
    return {
        str: calculateModifier(stats.str),
        dex: calculateModifier(stats.dex),
        con: calculateModifier(stats.con),
        wil: calculateModifier(stats.wil),
        spi: calculateModifier(stats.spi),
        int: calculateModifier(stats.int)
    };
}

function getRandomInt(max){
    return Math.floor((Math.random() * max)+1);
}

// Roll 5d20 for a stat (STR, DEX, CON, WIL, SPI) - can be rerolled once
function roll5d20() {
    let total = 0;
    for (let i = 0; i < 5; i++) {
        total += getRandomInt(20);
    }
    return total;
}

// Roll intelligence based on race
function rollIntelligence(race) {
    if (race === 'Earthling') {
        return getRandomInt(10) + 1; // 1d10+1
    } else if (race === 'Tuffle') {
        return getRandomInt(12) + 3; // 1d12+3
    } else {
        return getRandomInt(10); // 1d10 (default)
    }
}

// Roll for mutation eligibility (1d20, need 19+ to get a mutation)
function rollMutation() {
    return getRandomInt(20);
}

// Roll boosted stats using mutation roll (1d100+20 per stat)
function rollBoostedStatForRace(race) {
    // If Frost Demon, use their special bonus
    if (race === 'Frost Demon') {
        return getRandomInt(100) + 30; // 1d100+30 for Frost Demons
    }
    
    // For other races: 1d100+20
    return getRandomInt(100) + 20;
}

// Get race-specific stat rolling configuration
function getRaceStatRolls(race) {
    const raceRolls = {
        'Saiyan': { diceSize: 20, bonus: 0 },
        'Half-Saiyan': { diceSize: 20, bonus: 0 },
        'Earthling': { diceSize: 20, bonus: 0 },
        'Frost Demon': { diceSize: 80, bonus: 10 },
        'Namekian': { diceSize: 20, bonus: 0 },
        'Cerealian': { diceSize: 20, bonus: 0 },
        'Konatsian': { diceSize: 20, bonus: 0 },
        'Tuffle': { diceSize: 20, bonus: 0 },
        'Oni': { diceSize: 20, bonus: 0 },
        'Hera': { diceSize: 20, bonus: 0 },
        'Tortle': { diceSize: 20, bonus: 0 },
        'Alien': { diceSize: 20, bonus: 0 },
        'Android': { diceSize: 20, bonus: 0 },
        'Bio-Android': { diceSize: 20, bonus: 0 },
        'Majin': { diceSize: 20, bonus: 0 }
    };
    
    return raceRolls[race] || { diceSize: 20, bonus: 0 };
}

// Roll one stat based on race-specific dice (1d20 for most, 1d80+10 for Frost Demon)
function rollStatForRace(race) {
    const config = getRaceStatRolls(race);
    return getRandomInt(config.diceSize) + config.bonus;
}

// Calculate HP based on CON
function calculateHP(con) {
    const conMod = Math.floor((con - 10) / 2);
    return 10 + (conMod * 2);
}

// Calculate Ki based on WIL and SPI
function calculateKi(wil, spi) {
    const wilMod = Math.floor((wil - 10) / 2);
    const spiMod = Math.floor((spi - 10) / 2);
    return 10 + wilMod + spiMod;
}

client.once(Events.ClientReady, c => {
    console.log(`Logged in as ${c.user.tag}`);

    const ping = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with "Pong!"');
    
    const hello = new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Says hello to someone')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to say hi to')
                .setRequired(false)
        )

    const search = new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search the area for items, missions, and merchants')
    
    const calculatePowerLevel = new SlashCommandBuilder()
        .setName('calculate')
        .setDescription('Calculate your power level')
        .addIntegerOption(option =>
            option
                .setName('str')
                .setDescription('strength value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('dex')
                .setDescription('dexterity value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('con')
                .setDescription('constitution value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('wil')
                .setDescription('willpower value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('spi')
                .setDescription('spirit value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('int')
                .setDescription('intelligence value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('maxhp')
                .setDescription('max hp value')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('maxki')
                .setDescription('max ki value')
                .setRequired(true)
        )

    const rest = new SlashCommandBuilder()
        .setName('rest')
        .setDescription('Rest your character.');

    const fish = new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Fish in the area');

    const createEnemy = new SlashCommandBuilder()
        .setName('enemy')
        .setDescription('Creates an enemy/enemies for you to fight!')
        .addIntegerOption(option =>
            option
                .setName('powerlevel')
                .setDescription('Power level to scale enemies off of')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Casual, Hard, Very Hard, Mentor, Boss')
                .setRequired(true)
        )

    const startBattle = new SlashCommandBuilder()
        .setName('battle-start')
        .setDescription('Start a battle with specified participants')
        .addUserOption(option =>
            option
                .setName('participant1')
                .setDescription('First participant')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('hp1')
                .setDescription('Participant 1 HP')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('str1')
                .setDescription('Participant 1 STR')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('dex1')
                .setDescription('Participant 1 DEX')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('con1')
                .setDescription('Participant 1 CON')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('wil1')
                .setDescription('Participant 1 WIL')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('participant2')
                .setDescription('Second participant')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('hp2')
                .setDescription('Participant 2 HP')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('str2')
                .setDescription('Participant 2 STR')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('dex2')
                .setDescription('Participant 2 DEX')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('con2')
                .setDescription('Participant 2 CON')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('wil2')
                .setDescription('Participant 2 WIL')
                .setRequired(true)
        )

    const battleAttack = new SlashCommandBuilder()
        .setName('battle-attack')
        .setDescription('Attack an opponent in battle')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('Target to attack')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('attacktype')
                .setDescription('Type of attack')
                .addChoices(
                    { name: 'Physical', value: 'physical' },
                    { name: 'Ki-Based', value: 'ki' }
                )
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName('isaction')
                .setDescription('Is this your main action? (false = bonus action)')
                .setRequired(true)
        )

    const battleStatus = new SlashCommandBuilder()
        .setName('battle-status')
        .setDescription('View current battle status')

    const battleRetreat = new SlashCommandBuilder()
        .setName('battle-retreat')
        .setDescription('Attempt to retreat from battle')
        .addUserOption(option =>
            option
                .setName('opponent')
                .setDescription('Opponent to retreat from')
                .setRequired(true)
        )

    const battleEnd = new SlashCommandBuilder()
        .setName('battle-end')
        .setDescription('End the current battle in this channel')

    const battleSave = new SlashCommandBuilder()
        .setName('battle-save')
        .setDescription('Save an incapacitated ally')
        .addUserOption(option =>
            option
                .setName('ally')
                .setDescription('Ally to save')
                .setRequired(true)
        )

    const battleNext = new SlashCommandBuilder()
        .setName('battle-next')
        .setDescription('End your turn and advance to the next combatant')

    const createCharacter = new SlashCommandBuilder()
        .setName('character-create')
        .setDescription('Create a new character (stats auto-rolled with 5d20 drop lowest)')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Character name')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('race')
                .setDescription('Character race')
                .setRequired(true)
                .addChoices(
                    { name: 'Saiyan', value: 'Saiyan' },
                    { name: 'Half-Saiyan', value: 'Half-Saiyan' },
                    { name: 'Earthling', value: 'Earthling' },
                    { name: 'Frost Demon', value: 'Frost Demon' },
                    { name: 'Namekian', value: 'Namekian' },
                    { name: 'Cerealian', value: 'Cerealian' },
                    { name: 'Konatsian', value: 'Konatsian' },
                    { name: 'Tuffle', value: 'Tuffle' },
                    { name: 'Oni', value: 'Oni' },
                    { name: 'Hera', value: 'Hera' },
                    { name: 'Tortle', value: 'Tortle' },
                    { name: 'Alien', value: 'Alien' },
                    { name: 'Android', value: 'Android' },
                    { name: 'Bio-Android', value: 'Bio-Android' },
                    { name: 'Majin', value: 'Majin' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('age')
                .setDescription('Character age')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('background')
                .setDescription('Character background/goal (optional)')
                .setRequired(false)
        )

    const viewCharacter = new SlashCommandBuilder()
        .setName('character-view')
        .setDescription('View your character profile')

    const updateCharacterHP = new SlashCommandBuilder()
        .setName('character-hp')
        .setDescription('Modify character HP')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to add/subtract (use negative for damage)')
                .setRequired(true)
        )

    const updateCharacterKi = new SlashCommandBuilder()
        .setName('character-ki')
        .setDescription('Modify character Ki')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount to add/subtract')
                .setRequired(true)
        )

    const characterInventory = new SlashCommandBuilder()
        .setName('character-inventory')
        .setDescription('View character inventory')

    const characterAddItem = new SlashCommandBuilder()
        .setName('character-additem')
        .setDescription('Add item to inventory')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('Item name')
                .setRequired(true)
        )

    const characterRaces = new SlashCommandBuilder()
        .setName('races')
        .setDescription('View available races and their abilities')
        .addStringOption(option =>
            option
                .setName('race')
                .setDescription('Specific race to view')
                .setRequired(false)
        )

    const characterSetImage = new SlashCommandBuilder()
        .setName('character-setimage')
        .setDescription('Set an image for your character')
        .addStringOption(option =>
            option
                .setName('imageurl')
                .setDescription('Direct image URL (e.g., from Imgur, Discord CDN)')
                .setRequired(true)
        )

    const useItem = new SlashCommandBuilder()
        .setName('use-item')
        .setDescription('Use a consumable item from your inventory')
        .addIntegerOption(option =>
            option
                .setName('slot')
                .setDescription('Inventory slot number (use /character-inventory to see slots)')
                .setRequired(true)
        )

    const wipeCharacter = new SlashCommandBuilder()
        .setName('character-wipe')
        .setDescription('⚠️ PERMANENTLY delete your character data')
        .addStringOption(option =>
            option
                .setName('confirmation')
                .setDescription('Type "DELETE" to confirm (this cannot be undone!)')
                .setRequired(true)
        )
        
    client.application.commands.create(calculatePowerLevel);
    client.application.commands.create(fish);
    client.application.commands.create(ping);
    client.application.commands.create(hello);
    client.application.commands.create(createEnemy);
    client.application.commands.create(search);
    client.application.commands.create(rest);
    client.application.commands.create(startBattle);
    client.application.commands.create(battleAttack);
    client.application.commands.create(battleStatus);
    client.application.commands.create(battleRetreat);
    client.application.commands.create(battleEnd);
    client.application.commands.create(battleSave);
    client.application.commands.create(battleNext);
    client.application.commands.create(createCharacter);
    client.application.commands.create(viewCharacter);
    client.application.commands.create(updateCharacterHP);
    client.application.commands.create(updateCharacterKi);
    client.application.commands.create(characterInventory);
    client.application.commands.create(characterAddItem);
    client.application.commands.create(characterRaces);
    client.application.commands.create(characterSetImage);
    client.application.commands.create(useItem);
    client.application.commands.create(wipeCharacter);
});

client.on(Events.InteractionCreate, async interaction => {
    // Handle button interactions first
    if (interaction.isButton()) {
        if (interaction.customId === 'reroll_stats') {
            await interaction.deferUpdate();
            
            const pending = pendingCharacters.get(interaction.user.id);

            if (!pending) {
                return interaction.followUp({ content: 'No pending character found! Create a new character with `/character-create`.', ephemeral: true });
            }

            if (pending.hasRerolled) {
                return interaction.followUp({ content: '❌ You have already used your one reroll!', ephemeral: true });
            }

            // Reroll stats
            const selectedRace = pending.data.race;
            const raceRollConfig = getRaceStatRolls(selectedRace);
            
            const newStats = {
                str: rollStatForRace(selectedRace),
                dex: rollStatForRace(selectedRace),
                con: rollStatForRace(selectedRace),
                wil: rollStatForRace(selectedRace),
                spi: rollStatForRace(selectedRace),
                int: rollIntelligence(selectedRace)
            };

            // Recalculate HP and Ki
            const maxHP = calculateHP(newStats.con);
            const maxKi = calculateKi(newStats.wil, newStats.spi);

            // Recalculate modifiers
            const newModifiers = calculateAllModifiers(newStats);

            // Update character data
            pending.data.stats = newStats;
            pending.data.modifiers = newModifiers;
            pending.data.maxHP = maxHP;
            pending.data.maxKi = maxKi;
            pending.data.powerLevel = characterManager.calculatePowerLevel({
                ...newStats,
                maxHP: maxHP,
                maxKi: maxKi
            });
            pending.hasRerolled = true;

            const raceInfo = races[selectedRace];

            // Build stat roll description
            let statRollDesc = `1d${raceRollConfig.diceSize}`;
            if (raceRollConfig.bonus > 0) statRollDesc += `+${raceRollConfig.bonus}`;
            statRollDesc += ' per stat';
            
            let intRollDesc = '1d10';
            if (selectedRace === 'Earthling') intRollDesc = '1d10+1';
            else if (selectedRace === 'Tuffle') intRollDesc = '1d12+3';

            let message = `🎲 **Stats Rerolled!** ✨\n\n`;
            message += `**${pending.data.name}** - ${pending.data.race} (Age ${pending.data.age})\n`;
            message += `**Power Level:** ${pending.data.powerLevel}\n\n`;
            message += `**Stats (${statRollDesc} for STR/DEX/CON/WIL/SPI, ${intRollDesc} for INT):**\n`;
            message += `STR: ${newStats.str} (${newModifiers.str >= 0 ? '+' : ''}${newModifiers.str}) | DEX: ${newStats.dex} (${newModifiers.dex >= 0 ? '+' : ''}${newModifiers.dex}) | CON: ${newStats.con} (${newModifiers.con >= 0 ? '+' : ''}${newModifiers.con})\n`;
            message += `WIL: ${newStats.wil} (${newModifiers.wil >= 0 ? '+' : ''}${newModifiers.wil}) | SPI: ${newStats.spi} (${newModifiers.spi >= 0 ? '+' : ''}${newModifiers.spi}) | INT: ${newStats.int} (${newModifiers.int >= 0 ? '+' : ''}${newModifiers.int})\n`;
            message += `HP: ${maxHP} | Ki: ${maxKi}\n\n`;
            
            if (raceInfo && raceInfo.passives && raceInfo.passives.length > 0) {
                message += `**Racial Passives:**\n`;
                raceInfo.passives.forEach(passive => {
                    message += `• **${passive.name}**: ${passive.description}\n`;
                });
                message += `\n`;
            }

            message += `⚠️ This is your final roll! Click **Confirm** to create the character.\n`;
            message += `🧬 You can still roll for mutation OR boost stats (5d100+20)!`;

            // Create confirm button and mutation button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roll_mutation')
                        .setLabel('🧬 Roll Mutation (1d20)')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('confirm_character')
                        .setLabel('✅ Confirm Character')
                        .setStyle(ButtonStyle.Success)
                );

            return await interaction.editReply({ content: message, components: [row] });
        }

        if (interaction.customId === 'roll_mutation') {
            const pending = pendingCharacters.get(interaction.user.id);

            if (!pending) {
                return interaction.reply({ content: 'No pending character found! Create a new character with `/character-create`.', ephemeral: true });
            }

            if (pending.mutationRolled || pending.usedMutationForStats || pending.chosenPath) {
                return interaction.reply({ content: '❌ You have already used your mutation roll!', ephemeral: true });
            }

            // Roll for mutation
            const mutationRoll = rollMutation();
            pending.mutationRolled = true;
            pending.mutationRoll = mutationRoll;
            pending.chosenPath = 'mutation'; // Lock in mutation path

            let mutationMessage = `\n\n🧬 **Mutation Roll:** ${mutationRoll}/20\n\n`;

            if (mutationRoll >= 19) {
                mutationMessage += `✨ **MUTATION ELIGIBLE!** ✨\n`;
                mutationMessage += `You rolled ${mutationRoll}! You can choose a mutation from the Dragon Ball universe or create your own.\n`;
                mutationMessage += `⚠️ **IMPORTANT:** Your custom mutation must be approved by Chilly (@sauce9011).\n\n`;
                
                // Show race-specific mutations
                const availableMutations = getAvailableMutations(pending.data.race);
                if (availableMutations.length > 0) {
                    mutationMessage += `**Available Mutations for ${pending.data.race}:**\n`;
                    availableMutations.forEach(mut => {
                        mutationMessage += `• **${mut.name}** - ${mut.description.substring(0, 100)}...\n`;
                    });
                    mutationMessage += `\n`;
                }
                
                mutationMessage += `**To apply your mutation, contact Chilly with your character name and desired mutation!**`;
            } else {
                mutationMessage += `❌ No mutation this time. (Need 19+ to qualify)\n`;
                mutationMessage += `But you can use this roll to **BOOST YOUR STATS** instead!\n`;
                mutationMessage += `Click the button below to reroll all stats with **5d100+20** (giving up mutation eligibility).`;
            }

            // Get current message content and append mutation result
            const selectedRace = pending.data.race;
            const raceRollConfig = getRaceStatRolls(selectedRace);
            const raceInfo = races[selectedRace];

            let statRollDesc = `1d${raceRollConfig.diceSize}`;
            if (raceRollConfig.bonus > 0) statRollDesc += `+${raceRollConfig.bonus}`;
            statRollDesc += ' per stat';
            
            let intRollDesc = '1d10';
            if (selectedRace === 'Earthling') intRollDesc = '1d10+1';
            else if (selectedRace === 'Tuffle') intRollDesc = '1d12+3';

            let message = pending.hasRerolled ? `🎲 **Stats Rerolled!** ✨\n\n` : `✨ **Character Preview!** ✨\n\n`;
            message += `**${pending.data.name}** - ${pending.data.race} (Age ${pending.data.age})\n`;
            message += `**Power Level:** ${pending.data.powerLevel}\n\n`;
            message += `**Stats (${statRollDesc} for STR/DEX/CON/WIL/SPI, ${intRollDesc} for INT):**\n`;
            message += `STR: ${pending.data.stats.str} (${pending.data.modifiers.str >= 0 ? '+' : ''}${pending.data.modifiers.str}) | DEX: ${pending.data.stats.dex} (${pending.data.modifiers.dex >= 0 ? '+' : ''}${pending.data.modifiers.dex}) | CON: ${pending.data.stats.con} (${pending.data.modifiers.con >= 0 ? '+' : ''}${pending.data.modifiers.con})\n`;
            message += `WIL: ${pending.data.stats.wil} (${pending.data.modifiers.wil >= 0 ? '+' : ''}${pending.data.modifiers.wil}) | SPI: ${pending.data.stats.spi} (${pending.data.modifiers.spi >= 0 ? '+' : ''}${pending.data.modifiers.spi}) | INT: ${pending.data.stats.int} (${pending.data.modifiers.int >= 0 ? '+' : ''}${pending.data.modifiers.int})\n`;
            message += `HP: ${pending.data.maxHP} | Ki: ${pending.data.maxKi}\n\n`;
            
            if (raceInfo && raceInfo.passives && raceInfo.passives.length > 0) {
                message += `**Racial Passives:**\n`;
                raceInfo.passives.forEach(passive => {
                    message += `• **${passive.name}**: ${passive.description}\n`;
                });
                message += `\n`;
            }

            message += mutationMessage;

            // Create buttons based on mutation roll result
            const row = new ActionRowBuilder();
            
            if (mutationRoll < 19) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('boost_stats')
                        .setLabel('💪 Boost Stats (1d100+20)')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('confirm_character')
                        .setLabel('✅ Confirm Character')
                        .setStyle(ButtonStyle.Success)
                );
            } else {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_character')
                        .setLabel('✅ Confirm Character')
                        .setStyle(ButtonStyle.Success)
                );
            }

            return await interaction.update({ content: message, components: [row] });
        }

        if (interaction.customId === 'boost_stats') {
            const pending = pendingCharacters.get(interaction.user.id);

            if (!pending) {
                return interaction.reply({ content: 'No pending character found! Create a new character with `/character-create`.', ephemeral: true });
            }

            if (pending.usedMutationForStats || pending.chosenPath === 'mutation') {
                return interaction.reply({ content: '❌ You already chose the mutation path! You cannot boost stats.', ephemeral: true });
            }
            
            if (pending.chosenPath === 'boost') {
                return interaction.reply({ content: '❌ You have already boosted your stats!', ephemeral: true });
            }

            // Reroll stats with boosted dice (1d100+20)
            const selectedRace = pending.data.race;
            
            const boostedStats = {
                str: rollBoostedStatForRace(selectedRace),
                dex: rollBoostedStatForRace(selectedRace),
                con: rollBoostedStatForRace(selectedRace),
                wil: rollBoostedStatForRace(selectedRace),
                spi: rollBoostedStatForRace(selectedRace),
                int: rollIntelligence(selectedRace)
            };

            // Recalculate HP and Ki
            const maxHP = calculateHP(boostedStats.con);
            const maxKi = calculateKi(boostedStats.wil, boostedStats.spi);

            // Recalculate modifiers
            const boostedModifiers = calculateAllModifiers(boostedStats);

            // Update character data
            pending.data.stats = boostedStats;
            pending.data.modifiers = boostedModifiers;
            pending.data.maxHP = maxHP;
            pending.data.maxKi = maxKi;
            pending.data.powerLevel = characterManager.calculatePowerLevel({
                ...boostedStats,
                maxHP: maxHP,
                maxKi: maxKi
            });
            pending.data.mutation = 'None'; // No mutation when boosting stats
            pending.usedMutationForStats = true;
            pending.chosenPath = 'boost'; // Lock in boost path

            const raceInfo = races[selectedRace];

            let intRollDesc = '1d10';
            if (selectedRace === 'Earthling') intRollDesc = '1d10+1';
            else if (selectedRace === 'Tuffle') intRollDesc = '1d12+3';

            let message = `💪 **STATS BOOSTED!** ✨\n\n`;
            message += `You used your mutation roll to boost your stats!\n\n`;
            message += `**${pending.data.name}** - ${pending.data.race} (Age ${pending.data.age})\n`;
            message += `**Power Level:** ${pending.data.powerLevel}\n\n`;
            message += `**Stats (1d100+20 per stat for STR/DEX/CON/WIL/SPI, ${intRollDesc} for INT):**\n`;
            message += `STR: ${boostedStats.str} (${boostedModifiers.str >= 0 ? '+' : ''}${boostedModifiers.str}) | DEX: ${boostedStats.dex} (${boostedModifiers.dex >= 0 ? '+' : ''}${boostedModifiers.dex}) | CON: ${boostedStats.con} (${boostedModifiers.con >= 0 ? '+' : ''}${boostedModifiers.con})\n`;
            message += `WIL: ${boostedStats.wil} (${boostedModifiers.wil >= 0 ? '+' : ''}${boostedModifiers.wil}) | SPI: ${boostedStats.spi} (${boostedModifiers.spi >= 0 ? '+' : ''}${boostedModifiers.spi}) | INT: ${boostedStats.int} (${boostedModifiers.int >= 0 ? '+' : ''}${boostedModifiers.int})\n`;
            message += `HP: ${maxHP} | Ki: ${maxKi}\n\n`;
            
            if (raceInfo && raceInfo.passives && raceInfo.passives.length > 0) {
                message += `**Racial Passives:**\n`;
                raceInfo.passives.forEach(passive => {
                    message += `• **${passive.name}**: ${passive.description}\n`;
                });
                message += `\n`;
            }

            message += `⚠️ You gave up mutation eligibility for these boosted stats.\n`;
            message += `\n✅ Click **Confirm** to create this character.`;

            // Create confirm button only
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_character')
                        .setLabel('✅ Confirm Character')
                        .setStyle(ButtonStyle.Success)
                );

            return await interaction.update({ content: message, components: [row] });
        }

        if (interaction.customId === 'confirm_character') {
            const pending = pendingCharacters.get(interaction.user.id);

            if (!pending) {
                return interaction.reply({ content: 'No pending character found! Create a new character with `/character-create`.', ephemeral: true });
            }

            // Add mutation info if rolled
            if (pending.mutationRolled && pending.mutationRoll >= 19) {
                pending.data.mutation = 'Pending Approval - Contact @sauce9011';
            }

            // Create the character
            const character = characterManager.createCharacter(interaction.user.id, pending.data);

            // Clean up pending data and active creation status
            pendingCharacters.delete(interaction.user.id);
            activeCreations.delete(interaction.user.id);

            let message = `✨ **Character Created!** ✨\n\n`;
            message += `**${character.name}** has been saved to your profile!\n`;
            message += `**Power Level:** ${character.powerLevel}\n\n`;
            
            if (pending.mutationRolled) {
                message += `🧬 **Mutation Roll:** ${pending.mutationRoll}/20\n`;
                if (pending.mutationRoll >= 19) {
                    message += `✅ You are **eligible for a mutation**! Contact Chilly to discuss your mutation.\n\n`;
                } else {
                    message += `❌ Did not qualify for mutation.\n\n`;
                }
            }
            
            message += `Use \`/character-view\` to see your full character sheet.`;

            return await interaction.update({ content: message, components: [] });
        }

        return;
    }
    
    if(!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === "ping"){
        interaction.reply("Pong!");
    }
    if (interaction.commandName === "fish"){
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You need a character to go fishing! Use `/character-create` to make one.');
        }

        // Check if character has a fishing rod
        const hasFishingRod = character.inventory && character.inventory.some(item => {
            const itemName = typeof item === 'string' ? item : item.name;
            return itemName.toLowerCase().includes('fishing rod');
        });

        if (!hasFishingRod) {
            return interaction.reply('❌ You need a **Fishing Rod** to fish! Find one using `/search`.');
        }

        const chance = getRandomInt(20);
        let fishItem = null;
        let text = "";

        if (chance === 1) {
            text = `${interaction.user.displayName}'s fishing rod lost 1 durability because they suck at fishing!`;
            // TODO: Implement durability system later
        } else if (chance >= 2 && chance < 5) {
            fishItem = { 
                name: 'Small Fish', 
                type: 'consumable',
                hp: 2, 
                ki: 2, 
                fatigue: 0 
            };
            text = `🎣 ${interaction.user.displayName} caught a **Small Fish**!\nAdded to inventory. Use it to restore **+2 HP** and **+2 Ki** when cooked.`;
        } else if (chance >= 5 && chance < 10) {
            fishItem = { 
                name: 'Medium Fish', 
                type: 'consumable',
                hp: 4, 
                ki: 4, 
                fatigue: 0 
            };
            text = `🎣 ${interaction.user.displayName} caught a **Medium Fish**!\nAdded to inventory. Use it to restore **+4 HP** and **+4 Ki** when cooked.`;
        } else if (chance >= 10 && chance < 15) {
            fishItem = { 
                name: 'Large Fish', 
                type: 'consumable',
                hp: 6, 
                ki: 6, 
                fatigue: -2 
            };
            text = `🎣 ${interaction.user.displayName} caught a **Large Fish**!\nAdded to inventory. Use it to restore **+6 HP**, **+6 Ki**, and **-2% Fatigue** when cooked.`;
        } else if (chance >= 15) {
            fishItem = { 
                name: 'Huge Fish', 
                type: 'consumable',
                hp: 9, 
                ki: 9, 
                fatigue: -4 
            };
            text = `🎣 ${interaction.user.displayName} caught a **Huge Fish**!\nAdded to inventory. Use it to restore **+9 HP**, **+9 Ki**, and **-4% Fatigue** when cooked.`;
        }

        // Add fish to inventory
        if (fishItem) {
            characterManager.addItem(interaction.user.id, character.id, fishItem);
        }

        interaction.reply(text);
    }
    if (interaction.commandName === "rest"){
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You need a character to rest! Use `/character-create` to make one.');
        }

        const restHPNum = getRandomInt(25);
        const restKiNum = getRandomInt(10);
        const restFatNum = getRandomInt(15);

        // Apply rest effects
        const oldHP = character.currentHP;
        const oldKi = character.currentKi;
        const oldFatigue = character.fatigue || 0;

        characterManager.modifyHP(interaction.user.id, character.id, restHPNum);
        characterManager.modifyKi(interaction.user.id, character.id, restKiNum);
        characterManager.modifyFatigue(interaction.user.id, character.id, -restFatNum);

        const newHP = Math.min(oldHP + restHPNum, character.maxHP);
        const newKi = Math.min(oldKi + restKiNum, character.maxKi);
        const newFatigue = Math.max(0, oldFatigue - restFatNum);

        let text = `💤 **${character.name}** took a rest and recovered:\n\n`;
        text += `❤️ HP: ${oldHP} → ${newHP} (+${restHPNum})\n`;
        text += `💙 Ki: ${oldKi} → ${newKi} (+${restKiNum})\n`;
        text += `😓 Fatigue: ${oldFatigue}% → ${newFatigue}% (-${restFatNum}%)`;

        interaction.reply(text);
    }
    if (interaction.commandName === "hello"){
        const user = interaction.options.getUser('user') || interaction.user;
        interaction.reply(`Hello! ${user.username}!`);
    }
    if (interaction.commandName == "calculate") {
        const str = interaction.options.getInteger('str');
        const dex = interaction.options.getInteger('dex');
        const con = interaction.options.getInteger('con');
        const wil = interaction.options.getInteger('wil');
        const spi = interaction.options.getInteger('spi');
        const int = interaction.options.getInteger('int');
        const maxhp = interaction.options.getInteger('maxhp');
        const maxki = interaction.options.getInteger('maxki');

        const powerLevel = Math.floor((str*1.5)+(wil*1.5)+(spi)+(con*0.75)+(spi*0.75)+(dex*0.7)+(int*0.5)+(maxhp/10)+(maxki/10)+0.5)+1;

        const text = `${interaction.user.displayName}, your power level is: `+powerLevel;

        interaction.reply(text);
    }
    if (interaction.commandName == "search"){
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You need a character to search! Use `/character-create` to make one.');
        }

        const items = ["Small Wallet (1000 zeni)","5x Resources","Recovery Capsule","Shovel","Hetap™","Vita Drink","Sage Water","Ki Recovery Capsule","Welding Torch","[Broken] Motherboard","Component","2x Copper Wires","[Destroyed][Unrepairable]Engine Conjunction","Mixed Capsule","Hunting Traps","Fishing Rod","Fishing Tackle","Healer's Kit","Skinning Knife","Senzu Bean"];
        
        // Check if character has Hera race bonus
        const raceInfo = races[character.race];
        const hasHeraBonus = raceInfo && raceInfo.bonuses && raceInfo.bonuses.search ? raceInfo.bonuses.search : 0;
        const heraPassive = character.race === 'Hera'; // For Treasure Hunters passive
        
        let rawNumber = getRandomInt(100);
        let searchNumber = rawNumber + hasHeraBonus;

        let text = "";

        if (searchNumber < 15){
            // Hera's Treasure Hunters passive: always find item on failed search
            if (heraPassive) {
                let itemNumber = getRandomInt(20)-1;
                let item = items[itemNumber];
                text = `🔍 **${character.name}** searched the area...\n\n`;
                text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n`;
                text += `❌ Failed to find anything, but **Treasure Hunters** passive activates!\n`;
                text += `✨ Found a **${item}**!`;
                
                // Add item to inventory
                characterManager.addItem(interaction.user.id, character.id, item);
            } else {
                text = `🔍 **${character.name}** searched the area...\n\n`;
                text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus}` : ''} = ${searchNumber}\n`;
                text += `❌ Found nothing!`;
            }
        } else if (searchNumber >= 15 && searchNumber < 30) {
            let alignment = getRandomInt(2);
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            if (alignment === 1) {
                text += `😈 Found a **negatively aligned merchant**!`;
            } else if (alignment === 2) {
                text += `😇 Found a **positively aligned merchant**!`;
            }
        } else if (searchNumber >= 30 && searchNumber < 50) {
            let itemNumber = getRandomInt(20)-1;
            let item = items[itemNumber];
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            text += `✨ Found a **${item}**!`;
            
            // Add item to inventory
            characterManager.addItem(interaction.user.id, character.id, item);
        } else if (searchNumber >= 50 && searchNumber < 65) {
            let alignment = getRandomInt(2);
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            if (alignment === 1) {
                text += `⚔️ Initiated a **negatively aligned casual mission**!`;
            } else if (alignment === 2) {
                text += `⚔️ Initiated a **positively aligned casual mission**!`;
            }
        } else if (searchNumber >= 65 && searchNumber < 75) {
            let alignment = getRandomInt(2);
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            if (alignment === 1) {
                text += `⚔️ Initiated a **negatively aligned challenging mission**!`;
            } else if (alignment === 2) {
                text += `⚔️ Initiated a **positively aligned challenging mission**!`;
            }
        } else if (searchNumber >= 75 && searchNumber < 80) {
            let alignment = getRandomInt(2);
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            if (alignment === 1) {
                text += `⚔️ Initiated a **negatively aligned very challenging mission**!`;
            } else if (alignment === 2) {
                text += `⚔️ Initiated a **positively aligned very challenging mission**!`;
            }
        } else if (searchNumber >= 80 && searchNumber < 93) {
            let alignment = getRandomInt(2);
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            if (alignment === 1) {
                text += `🥋 Found a **negatively aligned mentor**!`;
            } else if (alignment === 2) {
                text += `🥋 Found a **positively aligned mentor**!`;
            }
        } else if (searchNumber >= 93 && searchNumber < 98) {
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n\n`;
            text += `🌟 Initiated a **SAGA MISSION**!!!`;
        } else if (searchNumber >= 98) {
            const legItems = ["Dragon Ball","Huge Treasure (1500000 zeni)","Brave Sword","Eldritch Rune","Ancient Wuxia Talisman","One Mans Trash","Bansho Fan","Magic Carpet","Spear of Longinus","True Capsule","Gravitational Control Chip","Jeremy Wade's Fishing Rod","Fountain of Youth","Seed of Might","Half-Saiyan's Sword","Dimensional Shard","Masterwork Weapon","Masterwork Armor","Bag of Senzu (16x)","Blood Vial","Blood Ruby"];
            
            // Hera uses 1d100+10 for legendary rolls (as per Trello)
            let legendaryRoll = heraPassive ? getRandomInt(100) + 10 : getRandomInt(20);
            let itemNumber = heraPassive ? Math.min(legendaryRoll - 1, 20) : getRandomInt(20) - 1;
            let item = legItems[itemNumber];
            
            text = `🔍 **${character.name}** searched the area...\n\n`;
            text += `Roll: ${rawNumber}${hasHeraBonus > 0 ? ` +${hasHeraBonus} (Hera bonus)` : ''} = ${searchNumber}\n`;
            if (heraPassive) {
                text += `Legendary Roll: 1d100+10 = ${legendaryRoll}\n\n`;
            } else {
                text += `\n`;
            }

            if (item === "Masterwork Armor") {
                const armor = ["light","medium","heavy"];
                const armNum = getRandomInt(3)-1;
                item = `Masterwork ${armor[armNum]} Armor`;
                text += `💎 Found **${item}**!!!`;
            } else if (item == "Masterwork Weapon") {
                const weps = ["Club", "Spiked Club", "Power Pole", "Sword", "Katana", "Scythe", "Nodachi", "Halberd", "Greatsword", "Greathammer"];
                let wepNum = getRandomInt(10)-1;
                item = `Masterwork ${weps[wepNum]}`;
                text += `💎 Found a **${item}**!!!`;
            } else {
                text += `💎 Found a **${item}**!!!`;
            }
            
            // Add legendary item to inventory
            characterManager.addItem(interaction.user.id, character.id, item);
        }

        interaction.reply(text);
    }
    if (interaction.commandName === "enemy"){
        const powerlevel = interaction.options.getInteger('powerlevel');
        const type = interaction.options.getString('type');
        const styles = ['Swordsman','Wolf','Crane','Wrestler','Boxing','Tiger','Taekwondo','Assassin','Legionary Discipline'];
        const bossStyles = ['Drake Knight','Shogun','Maniac'];
        let amount = 1;
        let enemy1 = [];
        let enemy2 = [];
        let enemy3 = [];
        let roll = 20;
        let mod = 0;
        let style = false;

        if (type.toLowerCase() === "casual") {

            if (powerlevel >= 3201 && powerlevel <= 6543 || powerlevel > 6543) {
                roll = 300;
            } else if (powerlevel >= 1601 && powerlevel <= 3200) {
                roll = 200;
            } else if (powerlevel >= 644 && powerlevel <= 1600) {
                roll = 140;
            } else if (powerlevel >= 81 && powerlevel <= 643) {
                roll = 80;
            } else if (powerlevel <= 80) {
                roll = 20;
            }
        } else if (type.toLowerCase() === "hard") {
            style = true;

            if (powerlevel >= 3201 && powerlevel <= 6543 || powerlevel > 6543) {
                roll = 500;
                mod = 80;
            } else if (powerlevel >= 1601 && powerlevel <= 3200) {
                roll = 300;
                mod = 60;
            } else if (powerlevel >= 644 && powerlevel <= 1600) {
                roll = 140;
                mod = 50;
            } else if (powerlevel >= 81 && powerlevel <= 643) {
                roll = 80;
                mod = 20;
            } else if (powerlevel <= 80) {
                roll = 40;
                mod = 10;
            }

        } else if (type.toLowerCase() === "very hard") {
            amount = getRandomInt(2)+1;
            style = true;

            if (powerlevel >= 3201 && powerlevel <= 6543 || powerlevel > 6543) {
                roll = 800;
                mod = 200;
            } else if (powerlevel >= 1601 && powerlevel <= 3200) {
                roll = 400;
                mod = 120;
            } else if (powerlevel >= 644 && powerlevel <= 1600) {
                roll = 200;
                mod = 80;
            } else if (powerlevel >= 81 && powerlevel <= 643) {
                roll = 100;
                mod = 40;
            } else if (powerlevel <= 80) {
                roll = 40;
                mod = 20;
            }
        } else if (type.toLowerCase() === "mentor") {
            style = true;

            if (powerlevel >= 3201 && powerlevel <= 6543 || powerlevel > 6543) {
                roll = 1000;
                mod = 120;
            } else if (powerlevel >= 1601 && powerlevel <= 3200) {
                roll = 600;
                mod = 90;
            } else if (powerlevel >= 644 && powerlevel <= 1600) {
                roll = 320;
                mod = 80;
            } else if (powerlevel >= 81 && powerlevel <= 643) {
                roll = 160;
                mod = 60;
            } else if (powerlevel <= 80) {
                roll = 80;
                mod = 20;
            }
        } else if (type.toLowerCase() === "boss") {
            style = true;
            if (powerlevel >= 3201 && powerlevel <= 6543 || powerlevel > 6543) {
                roll = 3000;
                mod = 200;
            } else if (powerlevel >= 1601 && powerlevel <= 3200) {
                roll = 1200;
                mod = 350;
            } else if (powerlevel >= 644 && powerlevel <= 1600) {
                roll = 600;
                mod = 120;
            } else if (powerlevel >= 81 && powerlevel <= 643) {
                roll = 460;
                mod = 60;
            } else if (powerlevel <= 80) {
                roll = 150;
                mod = 20;
            }
        }

        for(let i = 0; i < amount; i++){
            if(i === 0){
                enemy1.push('**STR:** '+(getRandomInt(roll)+mod));
                enemy1.push('**DEX:** '+(getRandomInt(roll)+mod));
                enemy1.push('**CON:** '+(getRandomInt(roll)+mod));
                enemy1.push('**WIL:** '+(getRandomInt(roll)+mod));
                enemy1.push('**SPI:** '+(getRandomInt(roll)+mod));
                if (style){
                    enemy1.push('**STYLE:** '+styles[getRandomInt(9)-1]);
                }
            }
            if(i === 1){
                enemy2.push('**STR:** '+(getRandomInt(roll)+mod));
                enemy2.push('**DEX:** '+(getRandomInt(roll)+mod));
                enemy2.push('**CON:** '+(getRandomInt(roll)+mod));
                enemy2.push('**WIL:** '+(getRandomInt(roll)+mod));
                enemy2.push('**SPI:** '+(getRandomInt(roll)+mod));
                if (style){
                    enemy2.push('**STYLE:** '+styles[getRandomInt(9)-1]);
                }
            }
            if(i === 2){
                enemy3.push('**STR:** '+(getRandomInt(roll)+mod));
                enemy3.push('**DEX:** '+(getRandomInt(roll)+mod));
                enemy3.push('**CON:** '+(getRandomInt(roll)+mod));
                enemy3.push('**WIL:** '+(getRandomInt(roll)+mod));
                enemy3.push('**SPI:** '+(getRandomInt(roll)+mod));
                if (style){
                    enemy3.push('**STYLE:** '+styles[getRandomInt(9)-1]);
                }
            }
        }
        
        let text = "**ENEMY 1:** \n";
        for(let i = 0; i < enemy1.length; i++){
            text += enemy1[i] + "\n";
        }
        if (enemy2.length !== 0){
            text += "\n**ENEMY 2:** \n";
            for(let i = 0; i < enemy2.length; i++){
                text += enemy2[i] + "\n";
            }
        }
        if (enemy3.length !== 0){
            text += "\n**ENEMY 3:** \n";
            for(let i = 0; i < enemy3.length; i++){
                text += enemy3[i] + "\n";
            }
        }

        let completeText = `${interaction.user.displayName} created enemies! \n**POWER LEVEL: **`+ powerlevel + '\n\n' + text

        interaction.reply(completeText);
    }

    // Battle System Commands
    if (interaction.commandName === 'battle-start') {
        const channelId = interaction.channelId;
        
        if (battleManager.hasBattle(channelId)) {
            return interaction.reply('A battle is already in progress in this channel! Use `/battle-end` to end it first.');
        }

        const p1 = interaction.options.getUser('participant1');
        const p2 = interaction.options.getUser('participant2');

        const participants = [
            {
                userId: p1.id,
                username: p1.username,
                hp: interaction.options.getInteger('hp1'),
                ki: 0,
                fatigue: 0,
                stats: {
                    str: interaction.options.getInteger('str1'),
                    dex: interaction.options.getInteger('dex1'),
                    con: interaction.options.getInteger('con1'),
                    wil: interaction.options.getInteger('wil1'),
                    spi: 0
                }
            },
            {
                userId: p2.id,
                username: p2.username,
                hp: interaction.options.getInteger('hp2'),
                ki: 0,
                fatigue: 0,
                stats: {
                    str: interaction.options.getInteger('str2'),
                    dex: interaction.options.getInteger('dex2'),
                    con: interaction.options.getInteger('con2'),
                    wil: interaction.options.getInteger('wil2'),
                    spi: 0
                }
            }
        ];

        const battle = battleManager.createBattle(channelId, participants);
        const turnOrder = battle.rollInitiative();

        let initiativeText = '⚔️ **BATTLE START!** ⚔️\n\n**Initiative Order:**\n';
        turnOrder.forEach((p, index) => {
            initiativeText += `${index + 1}. ${p.username} (Initiative: ${p.initiative})\n`;
        });

        initiativeText += `\n**Round 1** - It's ${turnOrder[0].username}'s turn!\n`;
        initiativeText += `HP: ${turnOrder[0].currentHP} | Actions Available: Action + Bonus Action`;

        interaction.reply(initiativeText);
    }

    if (interaction.commandName === 'battle-attack') {
        const channelId = interaction.channelId;
        const battle = battleManager.getBattle(channelId);

        if (!battle) {
            return interaction.reply('No battle in progress! Use `/battle-start` to begin.');
        }

        const currentTurn = battle.getCurrentTurn();
        if (currentTurn.userId !== interaction.user.id) {
            return interaction.reply(`It's not your turn! Waiting for ${currentTurn.username}.`);
        }

        const target = interaction.options.getUser('target');
        const attackType = interaction.options.getString('attacktype');
        const isAction = interaction.options.getBoolean('isaction');

        const result = await battle.attack(interaction.user.id, target.id, attackType, isAction);

        if (!result.success) {
            return interaction.reply(result.message);
        }

        // Build result message
        let message = `🎲 **${interaction.user.username}** attacks **${target.username}**!\n\n`;
        message += `Attack Roll: **${result.attackRoll}** + DEX mod = **${result.attackTotal}**\n`;
        message += `Defense Roll: **${result.defenseRoll}** + DEX mod = **${result.defenseTotal}**\n\n`;

        if (result.critical) {
            message += '💥 **CRITICAL HIT!** (+5 damage)\n';
        }

        if (result.hit) {
            message += `✅ **HIT LANDS!**\n`;
            message += `Damage: ${result.damageRoll} + mod = **${result.damage} damage**\n`;
            
            if (result.limbBreakAttempt) {
                if (result.limbBreakAttempt.success) {
                    message += `\n🦴 **LIMB ${result.limbBreakAttempt.type.toUpperCase()}!** (${result.limbBreakAttempt.limb})\n`;
                } else {
                    message += `\n🛡️ Limb break resisted!\n`;
                }
            }

            if (result.knockedOut) {
                message += `\n💀 **${target.username} is KNOCKED OUT!**\n`;
            }
        } else if (result.blocked) {
            message += `🛡️ **BLOCKED!** (80% damage reduction)\n`;
            message += `Damage: ${result.damageRoll} + mod × 0.2 = **${result.damage} damage**\n`;
        } else if (result.dodged) {
            message += `💨 **DODGED!** No damage taken.\n`;
        } else if (result.clash) {
            message += `⚡ **CLASH!** Both fighters matched!\n`;
        }

        const defender = battle.turnOrder.find(p => p.userId === target.id);
        message += `\n${target.username}'s HP: **${defender.currentHP}**\n`;

        // Check if action or bonus action remains
        const actionsLeft = [];
        if (!currentTurn.hasActed) actionsLeft.push('Action');
        if (!currentTurn.hasBonusActed) actionsLeft.push('Bonus Action');
        
        if (actionsLeft.length > 0) {
            message += `\nActions remaining: ${actionsLeft.join(', ')}`;
        } else {
            message += `\n✅ Turn complete! Use \`/battle-next\` to advance.`;
        }

        interaction.reply(message);
    }

    if (interaction.commandName === 'battle-status') {
        const channelId = interaction.channelId;
        const battle = battleManager.getBattle(channelId);

        if (!battle) {
            return interaction.reply('No battle in progress!');
        }

        const status = battle.getStatus();
        let message = `⚔️ **BATTLE STATUS - Round ${status.round}**\n\n`;
        
        message += `**Current Turn:** ${status.currentTurn.username}\n\n`;
        message += `**Participants:**\n`;

        status.participants.forEach(p => {
            let statusIcons = [];
            if (p.isDead) statusIcons.push('💀 DEAD');
            else if (p.isIncapacitated) statusIcons.push('😵 INCAPACITATED');
            
            message += `\n**${p.username}**\n`;
            message += `HP: ${p.hp} | Ki: ${p.ki} | Fatigue: ${p.fatigue}%\n`;
            
            if (statusIcons.length > 0) {
                message += `Status: ${statusIcons.join(', ')}\n`;
            }
            
            if (p.brokenLimbs.length > 0) {
                message += `Injuries: ${p.brokenLimbs.map(l => `${l.limb} (${l.type})`).join(', ')}\n`;
            }

            if (p.userId === status.currentTurn.userId) {
                const actions = [];
                if (!p.hasActed) actions.push('Action');
                if (!p.hasBonusActed) actions.push('Bonus Action');
                if (actions.length > 0) {
                    message += `Available: ${actions.join(', ')}\n`;
                }
            }
        });

        interaction.reply(message);
    }

    if (interaction.commandName === 'battle-retreat') {
        const channelId = interaction.channelId;
        const battle = battleManager.getBattle(channelId);

        if (!battle) {
            return interaction.reply('No battle in progress!');
        }

        const currentTurn = battle.getCurrentTurn();
        if (currentTurn.userId !== interaction.user.id) {
            return interaction.reply(`It's not your turn! Waiting for ${currentTurn.username}.`);
        }

        const opponent = interaction.options.getUser('opponent');
        const result = battle.attemptRetreat(interaction.user.id, opponent.id);

        let message = `🏃 **${interaction.user.username}** attempts to retreat!\n\n`;
        message += `Your roll: **${result.participantRoll}**\n`;
        message += `Required: **${result.requiredRoll}**\n\n`;

        if (result.escaped) {
            message += `✅ **ESCAPED!** You flee to area ${result.area}!\n`;
            battleManager.endBattle(channelId);
        } else {
            message += `❌ **FAILED!** You lose your full turn and gain disadvantage until your next turn ends!`;
        }

        interaction.reply(message);
    }

    if (interaction.commandName === 'battle-end') {
        const channelId = interaction.channelId;
        
        if (!battleManager.hasBattle(channelId)) {
            return interaction.reply('No battle in progress!');
        }

        battleManager.endBattle(channelId);
        interaction.reply('⚔️ Battle ended!');
    }

    if (interaction.commandName === 'battle-save') {
        const channelId = interaction.channelId;
        const battle = battleManager.getBattle(channelId);

        if (!battle) {
            return interaction.reply('No battle in progress!');
        }

        const currentTurn = battle.getCurrentTurn();
        if (currentTurn.userId !== interaction.user.id) {
            return interaction.reply(`It's not your turn! Waiting for ${currentTurn.username}.`);
        }

        const ally = interaction.options.getUser('ally');
        const result = battle.saveAlly(interaction.user.id, ally.id);

        if (!result.success) {
            return interaction.reply(result.message);
        }

        let message = `🏥 **${interaction.user.username}** saves **${ally.username}**!\n\n`;
        
        if (result.stable) {
            message += `✅ ${ally.username} is now **STABLE** and no longer needs death saves!`;
        } else {
            message += `${ally.username} succeeds one death save. One more needed to stabilize.`;
        }

        interaction.reply(message);
    }

    if (interaction.commandName === 'battle-next') {
        const channelId = interaction.channelId;
        const battle = battleManager.getBattle(channelId);

        if (!battle) {
            return interaction.reply('No battle in progress!');
        }

        const currentTurn = battle.getCurrentTurn();
        if (currentTurn.userId !== interaction.user.id) {
            return interaction.reply(`It's not your turn! Waiting for ${currentTurn.username}.`);
        }

        // Check if participant is incapacitated and needs death save
        if (currentTurn.isIncapacitated) {
            const saveResult = battle.deathSave(currentTurn.userId);
            
            let message = `💀 **${currentTurn.username}** rolls a death save!\n\n`;
            message += `Roll: **${saveResult.roll}** ${saveResult.success ? '(Success)' : '(Failure)'}\n`;
            message += `Successes: ${saveResult.succeededSaves}/2 | Failures: ${saveResult.failedSaves}/3\n\n`;

            if (saveResult.dead) {
                message += `☠️ **${currentTurn.username} has DIED!**`;
            } else if (saveResult.stable) {
                message += `✅ **${currentTurn.username} is now STABLE!**`;
            }

            await interaction.reply(message);
        }

        const nextTurn = battle.nextTurn();
        
        let message = `\n⏭️ **Round ${battle.round}** - It's **${nextTurn.username}**'s turn!\n`;
        message += `HP: ${nextTurn.currentHP} | Ki: ${nextTurn.currentKi}\n`;
        message += `Actions: Action + Bonus Action`;

        if (nextTurn.turnDisadvantage) {
            message += `\n⚠️ **DISADVANTAGE** on all rolls this turn!`;
        }

        interaction.reply(message);
    }

    // Character Management Commands
    if (interaction.commandName === 'character-create') {
        // Check if user already has a pending character creation
        if (activeCreations.has(interaction.user.id)) {
            return interaction.reply('❌ You already have a character creation in progress! Please complete or cancel that one first.');
        }

        const selectedRace = interaction.options.getString('race');
        const raceRollConfig = getRaceStatRolls(selectedRace);
        
        // Roll stats using race-specific dice (5d20 for most, 5d80+10 for Frost Demon)
        // Intelligence is rolled based on race (1d10 default, 1d10+1 for Earthling, 1d12+3 for Tuffle)
        const rolledStats = {
            str: rollStatForRace(selectedRace),
            dex: rollStatForRace(selectedRace),
            con: rollStatForRace(selectedRace),
            wil: rollStatForRace(selectedRace),
            spi: rollStatForRace(selectedRace),
            int: rollIntelligence(selectedRace)
        };

        // Calculate HP and Ki based on stats
        const maxHP = calculateHP(rolledStats.con);
        const maxKi = calculateKi(rolledStats.wil, rolledStats.spi);

        // Calculate modifiers
        const modifiers = calculateAllModifiers(rolledStats);

        const characterData = {
            name: interaction.options.getString('name'),
            race: selectedRace,
            age: interaction.options.getInteger('age'),
            stats: rolledStats,
            modifiers: modifiers,
            maxHP: maxHP,
            maxKi: maxKi,
            background: interaction.options.getString('background') || 'None provided',
            mutation: 'None'
        };

        // Calculate power level
        characterData.powerLevel = characterManager.calculatePowerLevel({
            ...characterData.stats,
            maxHP: characterData.maxHP,
            maxKi: characterData.maxKi
        });

        // Store pending character data for potential reroll
        pendingCharacters.set(interaction.user.id, {
            data: characterData,
            hasRerolled: false,
            mutationRolled: false,
            mutationRoll: null,
            usedMutationForStats: false,
            chosenPath: null // Track whether user chose 'mutation' or 'boost' path
        });

        // Mark user as in active creation
        activeCreations.set(interaction.user.id, Date.now());

        const raceInfo = races[selectedRace];

        // Build stat roll description
        let statRollDesc = `1d${raceRollConfig.diceSize}`;
        if (raceRollConfig.bonus > 0) statRollDesc += `+${raceRollConfig.bonus}`;
        statRollDesc += ' per stat';
        
        let intRollDesc = '1d10';
        if (selectedRace === 'Earthling') intRollDesc = '1d10+1';
        else if (selectedRace === 'Tuffle') intRollDesc = '1d12+3';

        let message = `✨ **Character Preview!** ✨\n\n`;
        message += `**${characterData.name}** - ${characterData.race} (Age ${characterData.age})\n`;
        message += `**Power Level:** ${characterData.powerLevel}\n\n`;
        message += `**Stats (${statRollDesc} for STR/DEX/CON/WIL/SPI, ${intRollDesc} for INT):**\n`;
        message += `STR: ${characterData.stats.str} (${modifiers.str >= 0 ? '+' : ''}${modifiers.str}) | DEX: ${characterData.stats.dex} (${modifiers.dex >= 0 ? '+' : ''}${modifiers.dex}) | CON: ${characterData.stats.con} (${modifiers.con >= 0 ? '+' : ''}${modifiers.con})\n`;
        message += `WIL: ${characterData.stats.wil} (${modifiers.wil >= 0 ? '+' : ''}${modifiers.wil}) | SPI: ${characterData.stats.spi} (${modifiers.spi >= 0 ? '+' : ''}${modifiers.spi}) | INT: ${characterData.stats.int} (${modifiers.int >= 0 ? '+' : ''}${modifiers.int})\n`;
        message += `HP: ${characterData.maxHP} | Ki: ${characterData.maxKi}\n\n`;
        
        if (raceInfo && raceInfo.passives && raceInfo.passives.length > 0) {
            message += `**Racial Passives:**\n`;
            raceInfo.passives.forEach(passive => {
                message += `• **${passive.name}**: ${passive.description}\n`;
            });
            message += `\n`;
        }

        message += `⚠️ You can reroll stats **once** or confirm to create this character.\n`;
        message += `🧬 Roll for mutation OR use it to boost stats (5d100+20)!`;

        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('reroll_stats')
                    .setLabel('🎲 Reroll Stats')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('roll_mutation')
                    .setLabel('🧬 Roll Mutation (1d20)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('confirm_character')
                    .setLabel('✅ Confirm Character')
                    .setStyle(ButtonStyle.Success)
            );

        interaction.reply({ content: message, components: [row] });
    }

    if (interaction.commandName === 'character-view') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have any characters! Use `/character-create` to make one.');
        }

        // Calculate modifiers if not stored
        if (!character.modifiers) {
            character.modifiers = calculateAllModifiers(character.stats);
        }

        // Create embedded character sheet
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${character.name}`)
            .setDescription(`**${character.race}** | Age ${character.age} | Level ${character.level}`)
            .addFields(
                { 
                    name: '⚡ Power Level', 
                    value: `**${character.powerLevel}**`, 
                    inline: false 
                },
                { 
                    name: '💪 Strength', 
                    value: `${character.stats.str} (${character.modifiers.str >= 0 ? '+' : ''}${character.modifiers.str})`, 
                    inline: true 
                },
                { 
                    name: '🏃 Dexterity', 
                    value: `${character.stats.dex} (${character.modifiers.dex >= 0 ? '+' : ''}${character.modifiers.dex})`, 
                    inline: true 
                },
                { 
                    name: '🛡️ Constitution', 
                    value: `${character.stats.con} (${character.modifiers.con >= 0 ? '+' : ''}${character.modifiers.con})`, 
                    inline: true 
                },
                { 
                    name: '🧠 Willpower', 
                    value: `${character.stats.wil} (${character.modifiers.wil >= 0 ? '+' : ''}${character.modifiers.wil})`, 
                    inline: true 
                },
                { 
                    name: '✨ Spirit', 
                    value: `${character.stats.spi} (${character.modifiers.spi >= 0 ? '+' : ''}${character.modifiers.spi})`, 
                    inline: true 
                },
                { 
                    name: '📚 Intelligence', 
                    value: `${character.stats.int} (${character.modifiers.int >= 0 ? '+' : ''}${character.modifiers.int})`, 
                    inline: true 
                },
                { 
                    name: '❤️ HP', 
                    value: `${character.currentHP}/${character.maxHP}`, 
                    inline: true 
                },
                { 
                    name: '💙 Ki', 
                    value: `${character.currentKi}/${character.maxKi}`, 
                    inline: true 
                },
                { 
                    name: '😓 Fatigue', 
                    value: `${character.fatigue}%`, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: `${character.experience} XP` });

        // Add character image if set
        if (character.imageUrl) {
            embed.setThumbnail(character.imageUrl);
        }

        // Add status effects if any
        if (character.statusEffects && character.statusEffects.length > 0) {
            const effects = character.statusEffects.map(e => e.name).join(', ');
            embed.addFields({ 
                name: '🔮 Status Effects', 
                value: effects, 
                inline: false 
            });
        }

        // Add mutation if present
        if (character.mutations && character.mutations !== 'None') {
            embed.addFields({ 
                name: '🧬 Mutation', 
                value: character.mutations, 
                inline: false 
            });
        }

        // Add background if present
        if (character.background && character.background !== 'None provided') {
            embed.addFields({ 
                name: '📖 Background', 
                value: character.background, 
                inline: false 
            });
        }

        // Add race info
        const raceInfo = races[character.race];
        if (raceInfo && raceInfo.abilities) {
            const abilities = raceInfo.abilities.slice(0, 3).join('\n• ');
            embed.addFields({ 
                name: '🌟 Racial Abilities', 
                value: `• ${abilities}`, 
                inline: false 
            });
        }

        interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'character-hp') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        const amount = interaction.options.getInteger('amount');
        const updated = characterManager.modifyHP(interaction.user.id, character.id, amount);

        const action = amount > 0 ? 'gained' : 'lost';
        const change = Math.abs(amount);
        
        let message = `${interaction.user.displayName}'s **${character.name}** ${action} **${change} HP**!\n`;
        message += `Current HP: ${updated.currentHP}/${updated.maxHP}`;

        if (updated.currentHP === 0) {
            message += `\n💀 **${character.name} is knocked out!**`;
        }

        interaction.reply(message);
    }

    if (interaction.commandName === 'character-ki') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        const amount = interaction.options.getInteger('amount');
        const updated = characterManager.modifyKi(interaction.user.id, character.id, amount);

        const action = amount > 0 ? 'gained' : 'used';
        const change = Math.abs(amount);
        
        let message = `${interaction.user.displayName}'s **${character.name}** ${action} **${change} Ki**!\n`;
        message += `Current Ki: ${updated.currentKi}/${updated.maxKi}`;

        interaction.reply(message);
    }

    if (interaction.commandName === 'character-inventory') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        let message = `**${character.name}'s Inventory:**\n\n`;

        if (!character.inventory || character.inventory.length === 0) {
            message += `Empty! Find items using \`/search\` or \`/fish\`.`;
        } else {
            character.inventory.forEach((item, index) => {
                const itemName = typeof item === 'string' ? item : item.name;
                message += `${index + 1}. ${itemName}\n`;
            });
        }

        interaction.reply(message);
    }

    if (interaction.commandName === 'character-additem') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        const itemName = interaction.options.getString('item');
        characterManager.addItem(interaction.user.id, character.id, itemName);

        interaction.reply(`Added **${itemName}** to ${character.name}'s inventory!`);
    }

    if (interaction.commandName === 'character-setimage') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        const imageUrl = interaction.options.getString('imageurl');
        
        // Basic URL validation
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            return interaction.reply('❌ Please provide a valid image URL starting with http:// or https://');
        }

        // Update character with image URL
        character.imageUrl = imageUrl;
        characterManager.updateCharacter(interaction.user.id, character.id, { imageUrl: imageUrl });

        // Create preview embed
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${character.name}`)
            .setDescription(`Image updated successfully!`)
            .setThumbnail(imageUrl);

        interaction.reply({ content: '✅ Character image set!', embeds: [embed] });
    }

    if (interaction.commandName === 'use-item') {
        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('You don\'t have a character! Use `/character-create` to make one.');
        }

        const slot = interaction.options.getInteger('slot');
        
        if (!character.inventory || character.inventory.length === 0) {
            return interaction.reply('❌ Your inventory is empty!');
        }

        if (slot < 1 || slot > character.inventory.length) {
            return interaction.reply(`❌ Invalid slot number! You have ${character.inventory.length} items. Use \`/character-inventory\` to see your items.`);
        }

        const item = character.inventory[slot - 1];
        const itemData = typeof item === 'string' ? { name: item, type: 'unknown' } : item;

        // Check if item is consumable
        if (itemData.type !== 'consumable') {
            return interaction.reply(`❌ **${itemData.name}** is not a consumable item!`);
        }

        // Apply item effects
        let message = `${interaction.user.displayName} consumed **${itemData.name}**!\n\n`;
        let effectsApplied = [];

        if (itemData.hp) {
            const oldHP = character.currentHP;
            characterManager.modifyHP(interaction.user.id, character.id, itemData.hp);
            const newHP = Math.min(oldHP + itemData.hp, character.maxHP);
            effectsApplied.push(`❤️ HP: ${oldHP} → ${newHP} (${itemData.hp > 0 ? '+' : ''}${itemData.hp})`);
        }

        if (itemData.ki) {
            const oldKi = character.currentKi;
            characterManager.modifyKi(interaction.user.id, character.id, itemData.ki);
            const newKi = Math.min(oldKi + itemData.ki, character.maxKi);
            effectsApplied.push(`💙 Ki: ${oldKi} → ${newKi} (${itemData.ki > 0 ? '+' : ''}${itemData.ki})`);
        }

        if (itemData.fatigue) {
            const oldFatigue = character.fatigue || 0;
            const newFatigue = Math.max(0, Math.min(100, oldFatigue + itemData.fatigue));
            characterManager.modifyFatigue(interaction.user.id, character.id, itemData.fatigue);
            effectsApplied.push(`😓 Fatigue: ${oldFatigue}% → ${newFatigue}% (${itemData.fatigue > 0 ? '+' : ''}${itemData.fatigue}%)`);
        }

        if (effectsApplied.length > 0) {
            message += effectsApplied.join('\n');
        } else {
            message += '✨ Item consumed, but had no effects!';
        }

        // Remove item from inventory
        character.inventory.splice(slot - 1, 1);
        characterManager.updateCharacter(interaction.user.id, character.id, { inventory: character.inventory });

        interaction.reply(message);
    }

    if (interaction.commandName === 'character-wipe') {
        const confirmation = interaction.options.getString('confirmation');
        
        if (confirmation !== 'DELETE') {
            return interaction.reply('❌ Wipe cancelled. You must type "DELETE" exactly to confirm character deletion.');
        }

        const character = characterManager.getCharacter(interaction.user.id);

        if (!character) {
            return interaction.reply('❌ You don\'t have any characters to wipe!');
        }

        // Delete the character
        const deleted = characterManager.deleteCharacter(interaction.user.id, character.id);

        if (deleted) {
            // Clear any pending character creation
            pendingCharacters.delete(interaction.user.id);
            activeCreations.delete(interaction.user.id);

            return interaction.reply(`🗑️ **Character Deleted**\n\n**${character.name}** (${character.race}, PL: ${character.powerLevel}) has been permanently wiped from the database.\n\nYou can create a new character with \`/character-create\`.`);
        } else {
            return interaction.reply('❌ Failed to delete character. Please try again.');
        }
    }

    if (interaction.commandName === 'races') {
        const specificRace = interaction.options.getString('race');

        if (specificRace) {
            const raceInfo = races[specificRace];
            if (!raceInfo) {
                return interaction.reply('Race not found!');
            }

            let message = `## ${raceInfo.name}\n\n`;
            message += `**Description:** ${raceInfo.description}\n\n`;
            message += `**Type:** ${raceInfo.type === 'birth' ? 'Obtainable Through Birth' : 'Obtainable Through Methods'}\n\n`;
            message += `**Racial Abilities:**\n`;
            raceInfo.abilities.forEach(ability => {
                message += `• ${ability}\n`;
            });

            if (raceInfo.bonuses) {
                message += `\n**Bonuses:**\n`;
                Object.entries(raceInfo.bonuses).forEach(([key, value]) => {
                    message += `• +${value} to ${key}\n`;
                });
            }

            return interaction.reply(message);
        }

        // List all races
        let message = `**Available Races:**\n\n`;
        message += `**Birth Races:**\n`;
        Object.values(races).filter(r => r.type === 'birth').forEach(race => {
            message += `• **${race.name}**\n`;
        });
        message += `\n**Method Races:**\n`;
        Object.values(races).filter(r => r.type === 'method').forEach(race => {
            message += `• **${race.name}**\n`;
        });
        message += `\nUse \`/races race:<name>\` to view details about a specific race.`;

        interaction.reply(message);
    }
});

client.login(token);