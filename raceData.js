// Race data extracted from Trello board
const races = {
    'Saiyan': {
        name: 'Saiyan',
        description: 'Saiyans are very similar in appearance to Human-type Earthlings with monkey-like tails.',
        classes: ['Low Class', 'Mid Class', 'Elite Class'],
        abilities: ['Warrior Race', 'Zenkai Boost', 'Great Ape Transformation'],
        passives: [
            { id: 'zenkai', name: 'Zenkai', description: 'When a saiyan recovers from a near death situation (<10% HP), gain PL × (1d15/100) stat points rounded up.' },
            { id: 'intense-anger', name: 'Intense Anger', description: 'Under intense stress (planet exploding, important death, last stand), add 25% of base stats and roll 1d50 to potentially unlock next Super Saiyan transformation on crit.' },
            { id: 'long-tail', name: 'Long Tail', description: 'Grapple attempts no longer have disadvantage against you.' }
        ],
        type: 'birth'
    },
    'Half-Saiyan': {
        name: 'Half-Saiyan',
        description: 'Half-Saiyans are generally identical to Saiyans but sometimes lack tails. Under stress, they exhibit their human side.',
        abilities: ['Hybrid Potential', 'Adaptive Combat'],
        passives: [
            { id: 'to-tail-or-not', name: 'To Tail or to Not', description: 'Roll 1d2 to decide if you grow a tail. 1 = No Tail, 2 = Tail' },
            { id: 'zenkai', name: 'Zenkai', description: 'When recovering from near death (<10% HP), gain PL × (1d10/100) stat points rounded up.' },
            { id: 'intense-anger', name: 'Intense Anger', description: 'Under intense stress, add 50% of stats and roll 1d40 to potentially unlock next Super Saiyan transformation on crit.' },
            { id: 'adept-in-ki', name: 'Adept in Ki', description: 'Regenerate (d2 + WIL modifier/2) Ki every round.' }
        ],
        type: 'birth'
    },
    'Earthling': {
        name: 'Earthling',
        description: 'Every living being from Planet Earth, with certain abilities in common.',
        abilities: ['Masters of Ki', 'Adaptive Learning', 'Resilient Spirit'],
        passives: [
            { id: 'masters-of-ki', name: 'Masters of Ki', description: 'Regenerate (4 + WIL modifier) Ki every round.' },
            { id: 'item-user', name: 'Item User', description: 'Consumable items are 100% more beneficial (rounded down).' },
            { id: 'intelligent', name: 'Intelligent', description: 'Roll 1d10+1 when rolling for initial intelligence.' },
            { id: 'highly-adaptable', name: 'Highly Adaptable', description: 'Advantage on saving throws.' },
            { id: 'adept-potential', name: 'Adept Potential', description: 'Roll 2d60+50 for potential unlock instead of standard roll.' }
        ],
        type: 'birth'
    },
    'Frost Demon': {
        name: 'Frost Demon',
        description: 'Bipedal humanoids with red eyes and white keratinous plating covering scaly reptilian skin.',
        abilities: ['Natural Armor', 'Multiple Forms', 'Cold Resistance'],
        passives: [
            { id: 'space-breathing', name: 'Space Breathing', description: 'Can survive in the vacuum of space.' },
            { id: 'suppression-forms', name: 'Suppression Forms', description: 'Can suppress into weaker forms to gain slight advantage against weaker opponents.' },
            { id: 'race-of-rulers', name: 'Race of Rulers', description: 'Born incredibly strong. Roll 5d80+10 for stat rolls instead of 5d20.' },
            { id: 'extraterrestrial-equilibrium', name: 'Extraterrestrial Equilibrium', description: 'Automatically gain the flight ability.' },
            { id: 'alien', name: 'Alien', description: 'Spawn on the Frieza Planet.' },
            { id: 'long-tail', name: 'Long Tail', description: 'Grapple attempts no longer have disadvantage against you.' }
        ],
        type: 'birth'
    },
    'Namekian': {
        name: 'Namekian',
        description: 'Humanoids with slug-like characteristics, including antennae and light green skin.',
        abilities: ['Regeneration', 'Fusion', 'Heightened Hearing', 'Dragon Clan/Warrior Clan'],
        passives: [
            { id: 'namekian', name: 'Namekian', description: 'Live on Namek.' },
            { id: 'regeneration', name: 'Regeneration', description: 'Natural ability to regenerate. Gain the Regeneration ability.' },
            { id: 'flexible', name: 'Flexible', description: 'Stretchy limbs. Spend 8 Ki to gain +4 mod to grapple attempts.' },
            { id: 'namekian-fusion', name: 'Namekian Fusion', description: 'Can fuse with another Namekian to become a Super Namekian. Roll varies by relationship (1d25/1d20/1d10), must critically succeed.' },
            { id: 'rebirth', name: 'Rebirth', description: 'Lay egg. When dying, reborn from egg gaining 100%+1d20% of previous stats plus new stat rolls. Once per 5 sagas.' },
            { id: 'large-ears', name: 'Large Ears', description: 'Sense people up to 10 areas away by hearing. Loud noises cause -7 DEX mod.' },
            { id: 'clan', name: 'Clan', description: 'Roll 1d2: Demon Clan (+2 DEX, +3 WIL, +3 STR, roll 5d40+10 for stats) or Dragon Clan (Create Dragon Ball, Magic Materialization, roll 1d10+2 for INT, +5 WIL, +5 SPI).' }
        ],
        type: 'birth'
    },
    'Cerealian': {
        name: 'Cerealian',
        description: 'Anthropomorphic aliens similar to Earthlings, with green hair and an evolved right eye.',
        abilities: ['Enhanced Vision', 'Precision Strike'],
        passives: [
            { id: 'evolved-right-eye', name: 'Evolved Right Eye', description: 'Capable snipers. Can reroll Ki attack for 7 Energy, once per attack.' },
            { id: 'exceptional-perception', name: 'Exceptional Perception', description: 'Every 5 turns vs same opponent, roll 1d5. On 5, opponent gets -1d3 DEX mod for rest of combat.' },
            { id: 'vital-strike', name: 'Vital Strike', description: 'Drain opponent energy. Uses 4 Energy, drains 10 Energy from target. On crit, deal 50% more damage.' }
        ],
        type: 'birth'
    },
    'Konatsian': {
        name: 'Konatsian',
        description: 'Humanoid appearance with varying skin tones and mystical affinity.',
        abilities: ['Mystical Heritage', 'Sword Mastery'],
        passives: [
            { id: 'heros-flute', name: "Hero's Flute", description: 'Play flute. Roll d20. If >15, remove all mental status effects including Blind Rage.' },
            { id: 'sword-proficiency', name: 'Sword Proficiency', description: 'Valiant swordsmen. +2 STR mod to sword attacks, -4 to DEX hindrances from weapons. Stacks with Swordsman fighting style.' },
            { id: 'feinting-strike', name: 'Feinting Strike', description: 'After crit success on sword damage roll, next attack has advantage.' }
        ],
        type: 'birth'
    },
    'Tuffle': {
        name: 'Tuffle',
        description: 'Small in stature with large brains and advanced technology affinity.',
        abilities: ['Technological Genius', 'Machine Interface'],
        passives: [
            { id: 'incredibly-intelligent', name: 'Incredibly Intelligent', description: 'Easily make and understand advanced technology. Roll 1d12+3 for initial intelligence.' },
            { id: 'physically-frail', name: 'Physically Frail', description: 'Not built for combat. -2 STR mod and -2 CON mod in combat.' },
            { id: 'advances-in-bioengineering', name: 'Advances in Bioengineering', description: 'Proficient in bioengineering. When making Androids, roll 5 8d100+120+(creator INT mod×10). Can also make Baby Tuffles.' }
        ],
        type: 'birth'
    },
    'Oni': {
        name: 'Oni',
        description: 'Muscular builds with horns, sharp claws, and varying skin tones.',
        abilities: ['Natural Weapons', 'Intimidating Presence', 'Demonic Heritage'],
        passives: [
            { id: 'extreme-strength', name: 'Extreme Strength', description: 'Abnormally strong but bulky. +5 STR mod, -3 DEX mod.' },
            { id: 'durable', name: 'Durable', description: '+5 CON mod.' },
            { id: 'enhanced-pump-up', name: 'Enhanced Pump Up', description: 'Body is stronger than most races. Pump Up is more effective.' }
        ],
        type: 'birth'
    },
    'Hera': {
        name: 'Hera',
        description: 'Humanoid with teal skin tones and orange hair.',
        abilities: ['Heran Strength', 'Battle Instinct'],
        passives: [
            { id: 'enhanced-physicals', name: 'Enhanced Physicals', description: 'Physically adept with great body control. +3 STR mod and +3 DEX mod. Roll 5d20+20 for stats instead of 5d20.' },
            { id: 'treasure-hunters', name: 'Treasure Hunters', description: 'Spent time looting and finding treasure. When failing search, always find an item. Roll 1d100+10 instead of 1d100. (Legendary rolls unaffected.)' },
            { id: 'enhanced-pump-up', name: 'Enhanced Pump Up', description: 'Body is stronger than most races. Pump Up is more effective.' }
        ],
        bonuses: { search: 10 },
        type: 'birth'
    },
    'Tortle': {
        name: 'Tortle',
        description: 'Wise humanoid turtles with deep connection to nature.',
        abilities: ['Natural Armor', 'Shell Defense', 'Ancient Wisdom'],
        passives: [
            { id: 'master-of-defense', name: 'Master of Defense', description: 'Giant turtle shell. +10 CON mod with downside of -5+15% DEX mod.' },
            { id: 'heavy-shed', name: 'Heavy Shed', description: 'Every week shed shell for +10 DEX mod, lose -5+15% CON mod. Shell regenerates 4 days after shed.' },
            { id: 'way-of-oogway', name: 'Way of Oogway', description: 'Descendants of Master Oogway. +2 SPI, +2 WIL, minimum 4 INT. Symbol of good luck, gain extra +1 Alignment from positive tasks.' },
            { id: 'shell-rest', name: 'Shell Rest', description: 'While having shell, hide for +5 modifier to short rests. Cannot use healing pods due to shell.' },
            { id: 'ancient-martial-weapon-proficiency', name: 'Ancient Martial Weapon Proficiency', description: 'Spiritual and physical connection with martial weapons. -1d3 DEX hindrance on martial weapons (Katana, Nodachi, Sai, Nun-Chucks, Bo-Staff, Spear, Power Pole).' },
            { id: 'descendants-of-way', name: 'Descendants of Way', description: 'All Tortles must have "Way" in their name, honoring saint Oogway.' }
        ],
        type: 'birth'
    },
    'Alien': {
        name: 'Alien',
        description: 'Anything not specifically listed. Custom abilities must be approved.',
        abilities: ['Custom (1-3 abilities)'],
        passives: [
            { id: 'custom-abilities', name: 'Custom Abilities', description: '1-3 custom abilities. MUST BE APPROVED.' }
        ],
        type: 'birth'
    },
    'Android': {
        name: 'Android',
        description: 'Artificial beings with mechanical enhancements.',
        abilities: ['Unlimited Energy', 'Mechanical Body', 'Self-Repair'],
        passives: [
            { id: 'nuclear-battery', name: 'Nuclear Battery', description: 'Ki replaced by charge. SPI dictates potential max charge. Starts at 50%. Refills after combat. Cannot regenerate charge in combat.' },
            { id: 'infinite-stamina', name: 'Infinite Stamina', description: 'Never fatigued by energy.' },
            { id: 'flesh-is-weak', name: 'Flesh is Weak', description: 'Cannot eat, sleep, or train. Can make mechanical clones. When dying, upload consciousness to clone. Upgrade through cybernetic enhancements. Must repair injuries at repair table.' }
        ],
        type: 'method'
    },
    'Bio-Android': {
        name: 'Bio-Android',
        description: 'Biological constructs with absorbed abilities.',
        abilities: ['Absorption', 'Regeneration', 'Adaptive DNA'],
        passives: [
            { id: 'absorption', name: 'Absorption', description: 'Can absorb and integrate biological traits or energies from others.' },
            { id: 'regeneration', name: 'Regeneration', description: 'Enhanced healing compared to average biologicals.' },
            { id: 'adaptive-dna', name: 'Adaptive DNA', description: 'DNA can adjust to new environments or threats, granting adaptability.' }
        ],
        type: 'method'
    },
    'Majin': {
        name: 'Majin',
        description: 'Magical beings with incredible regeneration and transformation.',
        abilities: ['Magical Nature', 'Regeneration', 'Absorption', 'Body Manipulation'],
        passives: [
            { id: 'magical-nature', name: 'Magical Nature', description: 'Innate magic grants access to unique techniques and transformations.' },
            { id: 'regeneration', name: 'Regeneration', description: 'Exceptional regeneration speeds recovery from wounds.' },
            { id: 'absorption', name: 'Absorption', description: 'Can absorb properties of matter and energy for personal growth.' },
            { id: 'body-manipulation', name: 'Body Manipulation', description: 'Can reshape and manipulate physical form for utility and combat.' }
        ],
        type: 'method'
    }
};

module.exports = { races };
