// Mutations from Dragon Ball D&D Trello
// These are powerful genetic variations that can alter a character's abilities

const mutations = {
    'Legendary Super Saiyan': {
        name: 'Legendary Super Saiyan',
        description: 'This mutation is caused by literal cosmic radiation reaching a Saiyan. Their size is morphed tremendously, the shortest being 6\'5, shoulder broader than any other.',
        raceRestrictions: ['Saiyan', 'Half-Saiyan'],
        type: 'transformation',
        formBonus: {
            description: 'Your veins bulge out your face as you roar, filling the realm with the presence of your voice. Temporal dimensions start to cave in on themselves as you unleash your power.',
            modifiers: {
                str: 25,
                dex: 25,
                con: 25,
                wil: 25,
                spi: 25,
                int: 0
            },
            perTurnBonus: '+5 ALL MODS per turn (increases by 5*turn number each turn)',
            kiGain: '+d80 Ki every turn',
            drain: '70 Energy per turn'
        }
    },
    'Zenkai Strain': {
        name: 'Zenkai Strain',
        description: 'This mutation happened randomly amongst Saiyans, where a warrior with extreme potential is born. Their growth through tough-fought battles is immensely increased.',
        raceRestrictions: ['Saiyan', 'Half-Saiyan'],
        type: 'passive',
        abilities: [
            {
                name: 'Godly Zenkai',
                description: 'When recovering from a near death situation (surviving a battle with less than 10% HP), gain PL x ((1d40+15)/100) rounded up as stat points.'
            }
        ]
    },
    'Extreme Potential': {
        name: 'Extreme Potential',
        description: 'You were born destined for greatness. Your genes mutated in a way that includes both Saiyan and Human potential. Your potential rivals that of frost demon mutants.',
        raceRestrictions: ['Half-Saiyan'],
        type: 'passive',
        abilities: [
            {
                name: 'Immense Potential',
                description: 'You are insanely gifted. Increase training roll result by 3x. You gain 2 more stat rolls when your potential is unlocked.'
            },
            {
                name: 'Ultimate',
                description: 'Your Mystic transformation is way stronger than normal.'
            },
            {
                name: 'Improved Zenkai',
                description: 'When recovering from a near death situation (surviving a battle with less than 10% HP), gain PL x ((1d25+15)/100) rounded up as stat points.'
            }
        ]
    },
    'Hope of the Universe': {
        name: 'Hope of the Universe',
        description: 'When forced into extreme situations, you tap into 100% of your potential and then some more. Your body starts to seemingly pull energy from its surroundings.',
        raceRestrictions: ['Earthling', 'Half-Saiyan'],
        type: 'conditional',
        trigger: 'When under 20% of your HP with extreme stakes (last stand with planet/galaxy/universe at stake)',
        abilities: [
            {
                name: 'Renewed Reason',
                description: 'Your body is revitalized with burning passion for battle. Heal back to half HP.'
            },
            {
                name: 'My Weapon is Judgement',
                description: 'Your sword/fists are engulfed by your ki, giving you +20 STR mod and removing the DEX mod debuff if using a weapon on your attacks. Your weapon cannot break. If opponent blocks, 40% of the attack goes through no matter what. Decapitation rolls have same requirement as amputation rolls.'
            },
            {
                name: 'Give Me Everything',
                description: 'Your HP is converted into energy, losing 10% HP per turn. Add +75 SPI mod to your Max Ki and set your energy back to max. If you drop to 0 HP from this passive, you die immediately. Consumables that restore HP are ineffective.'
            }
        ]
    },
    'Third Eye': {
        name: 'Third Eye',
        description: 'You are a descendent of the Three-Eye people, usually worshipped as god-like by Earthlings. These good natured people can see into the souls of people, giving them much more insight than usual.',
        raceRestrictions: ['Earthling'],
        type: 'transformation',
        requirements: {
            innate: 'Can be used on top of other forms',
            peaceful: 'Cannot be used with forms that cause stress (Kaioken, Pump up)',
            pureHearted: 'Cannot be used when negatively aligned (your third eye closes)'
        },
        awakening: 'Every battle, roll 4d100 + Awakening mod. Save is 400. Gain +1 to awakening mod each fail.',
        abilities: [
            {
                name: 'Soul Insight (Untrained)',
                description: 'You can see true intents of people\'s soul. Roll 1d20 using 3 energy to see the alignment of a specified entity, negating persuasion and deception rolls if roll is ≥10.'
            },
            {
                name: 'Enhanced Perception (Untrained)',
                description: 'Your eye helps with attacking and defending immensely. Add +3 DEX to defense and attack rolls.'
            },
            {
                name: 'God-like Perception (Trained)',
                description: 'You perceive things in slow motion. Add +5 DEX to defense and attack rolls and extra +2 DEX if your DEX is higher than opponent\'s. When critically succeeding defense roll on ki attack, reflect attack back, optionally increasing damage by 20% by spending 10 ki.'
            },
            {
                name: 'Proactive Actions (Trained)',
                description: 'Before enemy attacks, spend 5 ki and gain +3 to defense roll result. If attack misses, immediately counter with basic attack. Stacks with other similar abilities.'
            },
            {
                name: 'Life-Force Synergy (Trained)',
                description: 'When health falls below 50%, add +5 to attack rolls and deal extra d25 damage on all physical and ki-based attacks for 3 turns. Costs 5% max HP each turn. Cannot be canceled early.'
            }
        ]
    },
    '5th Transformation': {
        name: '5th Transformation',
        description: 'You have evolved past your predecessors. Your body has crushed your racial limits and have attained a new ceiling of power.',
        raceRestrictions: ['Frost Demon'],
        type: 'transformation',
        abilities: [
            {
                name: '5th Form',
                description: 'You can use the fifth transformation of Frost Demon.'
            }
        ]
    },
    'Prodigious Achievement': {
        name: 'Prodigious Achievement',
        description: 'From birth, your power was abnormally (and almost unnaturally) high. You were usually abysmally stronger than the fighters that opposed you. You never really had to struggle for strength.',
        raceRestrictions: ['Frost Demon'],
        type: 'passive',
        abilities: [
            {
                name: 'Abnormal Growth',
                description: 'Your body easily adapts to stresses. When rolling for training, add +25% to the roll and multiply the result by 1d2+1 on top of gravity multipliers.'
            },
            {
                name: 'Born Ruler',
                description: 'Your natural strength makes the universe bow. When rolling for initial stats, roll 5 2d80+40 instead of 5d20.'
            },
            {
                name: 'Prone to Comfortability',
                description: 'Since you never really had to struggle or train much, it is much harder to control your power. Your mastery requirements on transformations are 4x harder. You cannot master other forms when you haven\'t mastered the previous form.'
            }
        ],
        masteryRequirements: {
            secondForm: 'Roll d100+Fail Modifier. Save is 75. [2 levels: 1/6 stats → 1/4 stats]. +1 to mastery roll every fail.',
            thirdForm: 'Roll 2d100+Fail Modifier. Save is 195. [3 levels: 1/3 → 1/2 → 1d7% energy regen]. +1 to mastery roll every fail.',
            finalForm: 'Roll 3d100+Fail Modifier. Save is 295. [4 levels: Base → x1.10 → x1.15 → x1.20]. +1 to mastery roll every fail.',
            fullPower: 'Roll 4d100+Fail Modifier. Save is 399. [5 levels with drain reduction]. Drain: 100 ki per turn.'
        }
    },
    'Slug': {
        name: 'Slug',
        description: 'You are a specimen amongst the demon clan warriors. You are feared for your absolutely terrifying physique and dominant physical prowess.',
        raceRestrictions: ['Namekian'],
        type: 'transformation',
        innate: 'Can be used on top of other forms',
        effect: {
            description: 'Gain +4 ALL MODS. Gain x30 PL.',
            drain: 'NONE'
        },
        abilities: [
            {
                name: 'Intimidating Stature',
                description: 'Your large frame intimidates enemies. Every turn, if bigger and have more PL than opponent, force a WIL saving throw of CON dice+CON mod.'
            },
            {
                name: 'Physical Prowess',
                description: 'Your freak physique amplifies your strength and speed. You can no longer obtain an injury when you block an attack.'
            },
            {
                name: 'Crushing Blows',
                description: 'When attacking an opponent\'s block, force them to make a CON saving throw with a save of STR dice+STR mod. If failed, apply 1 turn of Off-Balance.'
            }
        ]
    },
    'Wise Old One': {
        name: 'Wise Old One',
        description: 'You are extremely wise. Your wisdom sometimes terrifies people and shakes their beliefs.',
        raceRestrictions: ['Namekian'],
        type: 'passive',
        requirement: 'CANNOT BE SELECTED IF NOT DRAGON CLAN',
        abilities: [
            {
                name: 'Understanding of Dormant Power',
                description: 'You fully understand how much potential someone has and how to draw it out. Gain the ability to unlock potential. Cooldowns still apply.'
            },
            {
                name: 'Ki Mastery',
                description: 'You have fully mastered ki. Gain fully mastered Ki Efficiency and Ki Sense.'
            },
            {
                name: 'Pacifist',
                description: 'You think combat is meaningless. Gain disadvantage to all attacking throws. Gain the ability to persuade in combat, forcing a WIL saving throw with a save of 17+SPI mod. If failed, opponent gains -12 to retreat chase rolls. Additionally, gain +7 with advantage to all persuasion checks.'
            },
            {
                name: 'Maker',
                description: 'Your wisdom allows you to make dragon balls much easier. Creating dragon balls now only costs 100 ki.'
            }
        ]
    },
    'Hunter of Legend': {
        name: 'Hunter of Legend',
        description: 'This mutation is rumored to occur every few thousand years, when a genius Cerealian falls under extreme stress, or becomes absorbed with vengeance.',
        raceRestrictions: ['Cerealian'],
        type: 'passive',
        abilities: [
            {
                name: 'Greater Mastery',
                description: 'All Cerealian abilities are slightly buffed.'
            },
            {
                name: 'Evolved Right Eye',
                description: 'Costs 5 energy, reroll advantage +2 on ki attacks.'
            },
            {
                name: 'Exception Perception',
                description: 'Applies every 4 turns. Roll a d4 every 4 turns, and if it lands on 4, then subtract 3 from enemy DEX rolls for the rest of combat.'
            },
            {
                name: 'Vital Strike',
                description: 'Costs 3 energy, and drains d16+WIL mod energy from opponent.'
            },
            {
                name: 'Raphael',
                description: 'You are much stronger than average. Your STR, CON, and SPI stats are rolled with d30+10, while DEX and WIL are rolled with d40+5. Any mastery requirements are lowered by 25%.'
            },
            {
                name: 'Hellbent',
                description: 'Your goal of killing the Gods of Destruction plagues your mind. Gain 2 extra dice when rolling for training.'
            },
            {
                name: 'Stone Cold',
                description: 'While facing a seemingly unstoppable foe, your character will stay levelheaded, and be immune to mental related disadvantages.'
            },
            {
                name: 'Burnout',
                description: 'As you try too hard in any field, resting is almost entirely useless. You will not heal while resting unless it\'s midnight, where you will only recover half your HP instead of all. You can still recover fatigue and ki.'
            }
        ]
    },
    'Dread-forged Ashen Soul': {
        name: 'Dread-forged Ashen Soul',
        description: 'The messenger of Death. You bring the feeling of doom with your very presence. Hell spat you out because you were too bitter for its gaping maw. Bastardized by your very home, you roam the overworld searching...',
        raceRestrictions: ['Oni'],
        type: 'passive',
        abilities: [
            {
                name: 'Mistake',
                description: 'Your very being is a mistake. Unlike many Onis, your bulky muscles do not slow you down. Negate the DEX penalty applied from being an Oni.'
            },
            {
                name: 'Fuel the Flames of Hatred',
                description: 'You feed off negative energy. Gain +2 to ALL MODS for every -70 alignment.'
            },
            {
                name: 'Damned',
                description: 'Cannot gain access to God Ki. When fighting against foes with God Ki, gain +5 to DEX and STR rolls. You also no longer gain disadvantage when fighting foes with God Ki.'
            },
            {
                name: 'Tormented',
                description: 'Cannot meditate, but gains +1 SPI mod every 5 kills. Kills also heal +10 HP and +5 Ki. (ONLY FROM COMBAT)'
            },
            {
                name: 'Unleashed',
                description: 'Gain access to Dark Devil form.'
            }
        ]
    },
    'Red Saibamen': {
        name: 'Red Saibamen',
        description: 'A simple transformation for a simple creature. This mutation of a mutation is red in hue, and is much angrier and self aware than the rest of its kind.',
        raceRestrictions: ['Saibamen'],
        type: 'passive',
        effect: {
            description: '+1 Strength Modifier, +1 Con Modifier, +1 Dexterity Modifier, +1 on Intelligence roll'
        },
        statBonus: {
            str: 1,
            dex: 1,
            con: 1,
            intRoll: 1
        }
    }
};

// Helper function to get available mutations for a race
function getAvailableMutations(race) {
    return Object.values(mutations).filter(mutation => 
        mutation.raceRestrictions.length === 0 || mutation.raceRestrictions.includes(race)
    );
}

// Helper function to get mutation by name
function getMutation(name) {
    return mutations[name] || null;
}

// Helper function to format mutation for display
function formatMutation(mutation) {
    let text = `**${mutation.name}**\n${mutation.description}\n\n`;
    
    if (mutation.abilities && mutation.abilities.length > 0) {
        text += `**Abilities:**\n`;
        mutation.abilities.forEach(ability => {
            text += `• **${ability.name}**: ${ability.description}\n`;
        });
        text += `\n`;
    }
    
    if (mutation.formBonus) {
        text += `**Form Bonus:**\n`;
        text += `${mutation.formBonus.description}\n`;
        if (mutation.formBonus.modifiers) {
            const mods = mutation.formBonus.modifiers;
            text += `STR: +${mods.str} | DEX: +${mods.dex} | CON: +${mods.con} | WIL: +${mods.wil} | SPI: +${mods.spi} | INT: +${mods.int}\n`;
        }
        if (mutation.formBonus.drain) {
            text += `**Drain**: ${mutation.formBonus.drain}\n`;
        }
    }
    
    return text;
}

module.exports = { mutations, getAvailableMutations, getMutation, formatMutation };
