const {Client, Events, GatewayIntentBits, SlashCommandBuilder} = require("discord.js");
const {token} = require("./.gitignore/config.json");

const client = new Client({intents: [GatewayIntentBits.Guilds]});

function getRandomInt(max){
    return Math.floor((Math.random() * max)+1);
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
        
    client.application.commands.create(calculatePowerLevel);
    client.application.commands.create(fish);
    client.application.commands.create(ping);
    client.application.commands.create(hello);
    client.application.commands.create(createEnemy);
    client.application.commands.create(search);
    client.application.commands.create(rest);
});

client.on(Events.InteractionCreate, interaction => {
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
});

client.login(token);