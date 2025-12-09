const {Client, Events, GatewayIntentBits, SlashCommandBuilder} = require("discord.js");
const {token} = require("./.gitignore/config.json");
const {BattleManager} = require("./battleManager");

const client = new Client({intents: [GatewayIntentBits.Guilds]});
const battleManager = new BattleManager();

function getRandomInt(max){
    return Math.floor((Math.random() * max)+1);
}

// TODO: add battle system
// Combat is on a turn-based basis. Who goes first is decided on initiative. (roll a raw d50 and whoever gets the highest goes first, in descending order.)
// ALL PLAYER WILL HAVE ONE ACTION AND ONE BONUS ACTION

// Player one will describe an Action and state specifically what they are using. If any, (PHYSICAL ATTACK OR KI-BASED ATTACK) clarify weather the attack is an action or bonus action.

// If attacking with either action or bonus actions during their turn, Player one (ATTACKER) and player (DEFENDER) two will both roll 1d20+DEX mod. If the attacker rolls higher than defender or if the defender critically fails (NAT 1), the hit lands. If the attacker rolls lower than the defender or if the attacker critically fails (NAT 1), that hit is either blocked or dodged: Both roll 1d20+DEX again. If the attacker critically failed, they roll 1d20-5. If the defender critically succeeded, they roll 1d20+5. If the attacker rolled higher than the defender, the attack is blocked negating 80% of the damage (Round down if decimal). However, if the attacker rolled lower than or the same as the defender, the defender dodges, receiving no damage. **If both the attacker and the defender roll the same, clash.

// Landing a CRITICAL ATTACK ROLL with at +5 to your attack damage.

// If the hit lands, the attacker will roll 1d5+STR/WILL mod. If the attacker critically succeeds (NAT 5 OR MAX ROLL), the attacker has a chance to break armor and break/remove a limb. The attacker rolls a d20+STR/WILL  mod. If the target is the defender’s head, roll a d18+STR/WILL  mod. The defender rolls a constitution saving throw. (if blocking, roll d35+CON mod. If not, roll d25+CON mod). If their throw is lower than the attacker’s roll, break/slice off the opponent’s limb. (If it is a blunt attack, then the specified limb is broken/concussed. If it is a slash attack, then the specified limb is sliced off.)

// After the an a player fully end’s their turn, it will now be the person’s turn who was next in order of initiative.

// This pattern continues to go on until one side has no more opposing players/player HP is 0.

// If the battle is not going in a player’s favor, they can attempt to retreat.
// Both players roll a d20. The roll needed to retreat is equal to the opponent’s roll + their DEX modifier. On a successful roll, the player will escape to a random area on the planet equal. (i.e roll = 356 so area-356) On a failed roll, They’ll lose their full turn and will gain disadvantage on all actions and actions bonus until the end of their next turn.

// If player is knocked out or incapacitated during combat.
// They must succeed a death d20 save every time it is their turn.
// Succeeding a death save 2 times (rolling over 8) times with leave you incapacitated. Failing a death save 3 times (Rolling under 8) will kill you. A player or npc can use an action on their turn to SAVE You and cause you to automatically succeed your death save, yet at the same can also target you and  still Attack You, which is a guaranteed attack, in doing so you will have to roll a con save( d20+Con ) if failed (Under 15) gain 1 failed death save.

//     rolls 1d20 = 9 = failed once , on their next turn rolled again 1d20= 3 failed again, on their next turn rolls 1d20=2 dead.

// Battles can be fought with more than 2 players. You’ll have to specify who’s on which team and who’s attacking who.

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
        .setDescription('Search the area')
        .addBooleanOption(option =>
            option
                .setName('hera')
                .setDescription('Is the character Hera')
                .setRequired(true)
        )
    
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
});

client.on(Events.InteractionCreate, async interaction => {
    if(!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "ping"){
        interaction.reply("Pong!");
    }
    if (interaction.commandName === "fish"){
        const chance = getRandomInt(20);
        let text = "";

        if (chance === 1) {
            text = `${interaction.user.displayName}'s fishing rod lost 1 durability because they suck at fishing!`;
        } else if (chance >= 2 && chance < 5) {
            text = `${interaction.user.displayName} caught a small fish!\n+2 HP and +2 KI when cooked.`;
        } else if (chance >= 5 && chance < 10) {
            text = `${interaction.user.displayName} caught a medium fish!\n+4 HP and +4 KI when cooked.`;
        } else if (chance >= 10 && chance < 15) {
            text = `${interaction.user.displayName} caught a large fish!\n+6 HP, +6 KI, and -2% Fatigue when cooked.`;
        } else if (chance >= 15) {
            text = `${interaction.user.displayName} caught a huge fish!\n+9 HP, +9 KI, and -4% Fatigue when cooked.`;
        } 

        interaction.reply(text);
    }
    if (interaction.commandName === "rest"){
        const restHPNum = getRandomInt(25);
        const restKiNum = getRandomInt(10);
        const restFatNum = getRandomInt(15);
        let text = `${interaction.user.displayName} regained:\n`+restHPNum+" HP\n"+restKiNum+" Ki\n"+restFatNum+"% Fatigue";

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
        const items = ["Small Wallet (1000 zeni)","5x Resources","Recovery Capsule","Shovel","Hetap™","Vita Drink","Sage Water","Ki Recovery Capsule","Welding Torch","[Broken] Motherboard","Component","2x Copper Wires","[Destroyed][Unrepairable]Engine Conjunction","Mixed Capsule","Hunting Traps","Fishing Rod","Fishing Tackle","Healer's Kit","Skinning Knife","Senzu Bean"];
        const heraBuff = interaction.options.getBoolean('hera');
        const debug = interaction.options.getBoolean('debug');
        let rawNumber = getRandomInt(100);
        let searchNumber = rawNumber;

        if (heraBuff) {
            searchNumber += 10;
        }

        let text = "";

        if (searchNumber < 15){
            text = `${interaction.user.displayName} found nothing!`;
        } else if (searchNumber >= 15 && searchNumber < 30) {
            let alignment = getRandomInt(2);
            if (alignment === 1) {
                text = `${interaction.user.displayName} found a negatively aligned merchant!`;
            } else if (alignment === 2) {
                text = `${interaction.user.displayName} found a merchant!`;
            }
        } else if (searchNumber >= 30 && searchNumber < 50) {
            let itemNumber = getRandomInt(20)-1;
            let item = items[itemNumber];

            text = `${interaction.user.displayName} found a `+item+"!";
        } else if (searchNumber >= 50 && searchNumber < 65) {
            let alignment = getRandomInt(2);
            if (alignment === 1) {
                text = `${interaction.user.displayName} initiated a negatively aligned casual mission!`;
            } else if (alignment === 2) {
                text = `${interaction.user.displayName} initiated a positively aligned casual mission!`;
            }
        } else if (searchNumber >= 65 && searchNumber < 75) {
            let alignment = getRandomInt(2);
            if (alignment === 1) {
                text = `${interaction.user.displayName} initiated a negatively aligned challenging mission!`;
            } else if (alignment === 2) {
                text = `${interaction.user.displayName} initiated a positively aligned challenging mission!`;
            }
        } else if (searchNumber >= 75 && searchNumber < 80) {
            let alignment = getRandomInt(2);
            if (alignment === 1) {
                text = `${interaction.user.displayName} initiated a negatively aligned very challenging mission!`;
            } else if (alignment === 2) {
                text = `${interaction.user.displayName} initiated a positively aligned very challenging mission!`;
            }
        } else if (searchNumber >= 80 && searchNumber < 93) {
            let alignment = getRandomInt(2);

            if (alignment === 1) {
                text = `${interaction.user.displayName} found a negatively aligned mentor!`;
            } else if (alignment === 2) {
                text = `${interaction.user.displayName} found a positively aligned mentor!`;
            }
        } else if (searchNumber >= 93 && searchNumber < 98) {
            text = `${interaction.user.displayName} initiated a **saga mission**!!!`;
        } else if (heraBuff && searchNumber >= 93 && searchNumber < 98) {
            text = `${interaction.user.displayName} initiated a **saga mission**!!!`;
        } else if (heraBuff && rawNumber >= 98 && rawNumber <= 100)  {
            const legItems = ["**Dragon Ball**","**Huge Treasure (1500000 zeni)**","**Brave Sword**","**Eldritch Rune**","**Ancient Wuxia Talisman**","**One Mans Trash**","**Bansho Fan**","**Magic Carpet**","**Spear of Longinus**","**True Capsule**","**Gravitational Control Chip**","**Jeremy Wade's Fishing Rod**","**Fountain of Youth**","**Seed of Might**","**Half-Saiyan's Sword**","**Dimensional Shard**","**Masterwork Weapon**","**Masterwork Armor**","**Bag of Senzu (16x)**","**Blood Vial**","**Blood Ruby**"];
            let itemNumber = getRandomInt(20)-1;
            let item = legItems[itemNumber];

            if (item === "Masterwork Armor") {
                const armor = ["**light**","**medium**","**heavy**"];
                const armNum = getRandomInt(3)-1;

                text = `${interaction.user.displayName} found masterwork `+armor[armNum]+" armor!!!";
            } else if (item == "Masterwork Weapon") {
                const weps = ["**Club**", "**Spiked Club**", "**Power Pole**", "**Sword**", "**Katana**", "**Scythe**", "**Nodachi**", "**Halberd**", "**Greatsword**", "**Greathammer**"];
                let wepNum = getRandomInt(10)-1;

                text = `${interaction.user.displayName} found a masterwork `+weps[wepNum]+"!!!";
            } else {
                text = `${interaction.user.displayName} found a `+item+"!!!";
            }
        } else if (!heraBuff && searchNumber >= 98 && searchNumber <= 100) {
            const legItems = ["**Dragon Ball**","**Huge Treasure (1500000 zeni)**","**Brave Sword**","**Eldritch Rune**","**Ancient Wuxia Talisman**","**One Mans Trash**","**Bansho Fan**","**Magic Carpet**","**Spear of Longinus**","**True Capsule**","**Gravitational Control Chip**","**Jeremy Wade's Fishing Rod**","**Fountain of Youth**","**Seed of Might**","**Half-Saiyan's Sword**","**Dimensional Shard**","**Masterwork Weapon**","**Masterwork Armor**","**Bag of Senzu (16x)**","**Blood Vial**","**Blood Ruby**"];
            let itemNumber = getRandomInt(20)-1;
            let item = legItems[itemNumber];

            if (item === "Masterwork Armor") {
                const armor = ["**light**","**medium**","**heavy**"];
                const armNum = getRandomInt(3)-1;

                text = `${interaction.user.displayName} found masterwork `+armor[armNum]+" armor!!!";
            } else if (item == "Masterwork Weapon") {
                const weps = ["**Club**", "**Spiked Club**", "**Power Pole**", "**Sword**", "**Katana**", "**Scythe**", "**Nodachi**", "**Halberd**", "**Greatsword**", "**Greathammer**"];
                let wepNum = getRandomInt(10)-1;

                text = `${interaction.user.displayName} found a masterwork `+weps[wepNum]+"!!!";
            } else {
                text = `${interaction.user.displayName} found a `+item+"!!!";
            }
        }

        if (heraBuff) {
            interaction.reply(text + "\nSearch Number: "+searchNumber+"\nRaw Roll: "+rawNumber);
        } else if (!heraBuff) {
            interaction.reply(text);
        }
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
});

client.login(token);