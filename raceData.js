// Race data extracted from Trello board
const races = {
    'Saiyan': {
        name: 'Saiyan',
        statMultiplierPoints: 7,
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
        statMultiplierPoints: 8,
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
        statMultiplierPoints: 10,
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
        statMultiplierPoints: 9,
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
        statMultiplierPoints: 6,
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
        statMultiplierPoints: 7,
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
        statMultiplierPoints: 6,
        description: 'Humanoid appearance with varying skin tones and mystical affinity.',
        abilities: ['Mystical Heritage', 'Sword Mastery'],
        passives: [
            { id: 'heros-flute', name: "Hero's Flute", description: 'Play flute. Roll d20. If >15, remove all mental status effects including Blind Rage.' },
            { id: 'sword-proficiency', name: 'Sword Proficiency', description: 'Valiant swordsmen. +5% STR mod to sword attacks, -10% to DEX hindrances from weapons. Stacks with Swordsman fighting style.' },
            { id: 'ki-sharpening', name: 'Innate Ki Sharpening', description: 'Innately knows Ki Sharpening: bonus-action toggle for +40% damage rolls, -20% DEX attack rolls, drains Ki each turn. Mastery rolls for it are 20% easier.' },
            { id: 'feinting-strike', name: 'Feinting Strike', description: 'After crit success on sword damage roll, next attack has advantage.' }
        ],
        type: 'birth'
    },
    'Tuffle': {
        name: 'Tuffle',
        statMultiplierPoints: 5,
        description: 'Small in stature with large brains and advanced technology affinity.',
        abilities: ['Technological Genius', 'Machine Interface'],
        passives: [
            { id: 'incredibly-intelligent', name: 'Incredibly Intelligent', description: 'Easily make and understand advanced technology. Roll 1d12+3 for initial intelligence.' },
            { id: 'physically-frail', name: 'Physically Frail', description: 'Not built for combat. -2 STR mod and -2 CON mod in combat.' },
            { id: 'advances-in-bioengineering', name: 'Advances in Bioengineering', description: 'Proficient in bioengineering. When making Androids, roll 5 8d100+120+(creator INT mod×10). Can also make Baby Tuffles.' }
        ],
        type: 'birth'
    },
    'Baby Tuffle': {
        name: 'Baby Tuffle',
        statMultiplierPoints: 6,
        description: 'Tuffle parasites that cannot live without a host. They burrow into a bleeding body, seize it, and drain the vessel of its full potential.',
        abilities: ['Vesselmonger', 'Life Hijack', 'Parasite Infection', 'My New Body', 'Hateful'],
        passives: [
            { id: 'vesselmonger', name: 'Vesselmonger', description: 'You need a lifeform to take control of. While outside of a body you take 2x damage, suffer -7 DEX mod, and are vulnerable to Spirit Fission. Take a vessel with Life Hijack to end this.' },
            { id: 'life-hijack', name: 'Life Hijack', description: 'Enter a body through its cuts: against a BLEEDING opponent, force a CON save (d20+CON mod) vs DC 35. On a failure they lose their body and you take it.' },
            { id: 'parasite-infection', name: 'Parasite Infection', description: 'Letting a host go leaves a parasite egg behind, turning them into a Tuffle servant until they break free (d20, MUST critically succeed: every 30 minutes, or every 5 turns in combat). A body you are currently wearing rolls to break free every hour, or every 5 turns in combat.' },
            { id: 'my-new-body', name: 'My New Body', description: 'While wearing a vessel you add the vessel\'s stats onto your own and receive the forms it had unlocked. Breaking free takes it all back.' },
            { id: 'hateful', name: 'Hateful', description: 'Gain access to Revenge Death Ball.' }
        ],
        type: 'method'
    },
    'Yokai': {
        name: 'Yokai',
        statMultiplierPoints: 7,
        description: 'Spirits of the dead who clawed their way back from judgment. Many carry faint traits echoing the animal or spirit legend tied to their rebirth.',
        abilities: ['Reborn', "Yemma's Price", 'Ghastly Structure', 'Variants'],
        passives: [
            { id: 'reborn', name: 'Reborn', description: 'Choose 2 racial abilities to keep from your past life.' },
            { id: 'yemmas-price', name: "Yemma's Price", description: 'Freely return to Earth from the Otherworld for 3 Legendary items and 75% of your stats.' },
            { id: 'ghastly-structure', name: 'Ghastly Structure', description: 'Intangible — can only be hit by Ki-based techniques until struck; takes 25% more damage from all sources.' },
            { id: 'yokai-variant', name: 'Variants', description: 'Randomly assigned: Kitsune (+5 SPI, -2 CON, Shapeshift), Nekomata (+5 DEX, -2 CON), Tengu (+4 attack with a fighting style).' }
        ],
        type: 'method'
    },
    'Oni': {
        name: 'Oni',
        statMultiplierPoints: 7,
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
        statMultiplierPoints: 8,
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
        statMultiplierPoints: 6,
        description: 'Wise humanoid turtles of the Tortless Way, with a deep connection to nature and remarkable defensive capabilities.',
        abilities: ['Master of Defense', 'Heavy Shed', 'Way of Oogway', 'Shell Rest', 'Ancient Martial Weapon Proficiency', 'Descendants of Way'],
        passives: [
            { id: 'master-of-defense', name: 'Master of Defense', description: 'While your shell is on, gain +10 CON mod but suffer a DEX mod penalty.' },
            { id: 'heavy-shed', name: 'Heavy Shed', description: 'Optional — shed your shell with /shed for +10 DEX mod but a CON mod penalty. The shell regenerates 4 days after shedding.' },
            { id: 'way-of-oogway', name: 'Way of Oogway', description: 'Descendants of Master Oogway: +2 SPI mod and +2 WIL mod, minimum 4 INT. Symbol of good luck — gain an extra +1 Alignment from all positive tasks.' },
            { id: 'shell-rest', name: 'Shell Rest', description: 'While your shell is on, hide in it for +5 modifier to short rests, but you cannot use healing pods due to your shell.' },
            { id: 'ancient-martial-weapon-proficiency', name: 'Ancient Martial Weapon Proficiency', description: 'Spiritual connection with martial weapons — -1d3 DEX hindrance on martial weapons (Katana, Nodachi, Sai, Nun-Chucks, Bo-Staff, Spear, Power Pole).' },
            { id: 'descendants-of-way', name: 'Descendants of Way', description: 'All Tortles must have "Way" in their name, honoring saint Oogway.' }
        ],
        type: 'birth'
    },
    'Alien': {
        name: 'Alien',
        statMultiplierPoints: 8,
        description: 'Anything not specifically listed. Custom abilities must be approved.',
        abilities: ['Custom (1-3 abilities)'],
        passives: [
            { id: 'custom-abilities', name: 'Custom Abilities', description: '1-3 custom abilities. MUST BE APPROVED.' }
        ],
        type: 'birth'
    },
    'Android': {
        name: 'Android',
        statMultiplierPoints: 4,
        description: 'Androids are mechanical versions of their specified races. Currently, the only known races to be converted are Cerealian, Earthling, and Tuffle.',
        abilities: ['Nuclear Battery', 'Infinite Stamina', 'Flesh is Weak'],
        passives: [
            { id: 'nuclear-battery', name: 'Nuclear Battery', description: 'Your Ki is replaced by charge — SPI dictates your potential max charge, and only 50% of it is usable until you upgrade. Your battery refills after every fight, and you cannot regenerate charge in combat.' },
            { id: 'infinite-stamina', name: 'Infinite Stamina', description: 'You are never fatigued by your energy — running your battery dry costs you no fatigue.' },
            { id: 'flesh-is-weak', name: 'Flesh is Weak', description: 'You cannot eat, sleep, or train. You can build mechanical clones (/make-clone) — when you die your consciousness uploads into one instead of passing on. Everything about you is upgraded with technology (/charge-upgrade).' }
        ],
        type: 'method'
    },
    'Bio-Android': {
        name: 'Bio-Android',
        statMultiplierPoints: 5,
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
        statMultiplierPoints: 6,
        description: 'Magical beings with incredible regeneration and transformation.',
        abilities: ['Magical Nature', 'Regeneration', 'Absorption', 'Body Manipulation'],
        passives: [
            { id: 'magical-nature', name: 'Magical Nature', description: 'Innate magic grants access to unique techniques and transformations.' },
            { id: 'regeneration', name: 'Regeneration', description: 'Exceptional regeneration speeds recovery from wounds.' },
            { id: 'absorption', name: 'Absorption', description: 'Can absorb properties of matter and energy for personal growth.' },
            { id: 'body-manipulation', name: 'Body Manipulation', description: 'Can reshape and manipulate physical form for utility and combat.' }
        ],
        type: 'method'
    },
    'Saibamen': {
        name: 'Saibamen',
        statMultiplierPoints: 7,
        description: 'Plant creatures born to kill, grown from seeds and growth liquid.',
        abilities: ['We Are Not The Same', 'Apex Predator', 'Plant Life', 'Ruler of Many', 'PTSD', 'Sharp Claws', 'Simple Minded'],
        passives: [
            { id: 'we-are-not-the-same', name: 'We Are Not The Same', description: 'Physical demons out the womb. Roll 5d50 for stats instead of 5d20.' },
            { id: 'apex-predator', name: 'Apex Predator', description: 'Quick and sneaky. Can camouflage themselves (including ki signatures) in vegetation. +20% to all Dexterity saving throws.' },
            { id: 'plant-life', name: 'Plant Life', description: 'Immune to all forms of poison, and regenerate limbs on short rests.' },
            { id: 'ruler-of-many', name: 'Ruler of Many', description: 'Once per saga (except the first), drain ki and health to 1 to release a seed. It sprouts 24 hours later with 1/10 of your stats, and can only self destruct or spar with you.' },
            { id: 'ptsd', name: 'PTSD', description: 'Fire every synapse at once to implode, ending your life and dealing (current HP + current Ki) damage. If a hatchling is nearby, transfer your consciousness to it instead.' },
            { id: 'sharp-claws', name: 'Sharp Claws', description: 'No need for ki blasts or weapons. Barehanded attacks can tear off limbs, and all critically successful attacks apply bleed for 1 turn.' },
            { id: 'simple-minded', name: 'Simple Minded', description: 'Roll 1d3 for intelligence instead of 1d10.' }
        ],
        type: 'birth'
    },
    'Sphinxian': {
        name: 'Sphinxian',
        statMultiplierPoints: 16,
        description: 'This constitutes the feline race descended from beings with an innate affinity for destruction. Sphinxians are naturally powerful and possess an instinctive talent for destroying anything that displeases them. Despite their immense potential, they are often spoiled, lazy, and accustomed to having their desires fulfilled without question.',
        abilities: ['Destructive Instinct', 'Short Temper', 'Spoiled', 'Lazy', 'Insatiable Potential', 'Space Breathing'],
        passives: [
            { id: 'destructive-instinct', name: 'Destructive Instinct', description: 'Attacks deal +10% damage against enemies with more than 50% of their maximum HP.' },
            { id: 'short-temper', name: 'Short Temper', description: 'When they take damage from an attack, gain 1d10+(WIL mod x0.1) damage on their next attack, stacking up to 3 times. The stacks reset after successfully landing an attack.' },
            { id: 'spoiled', name: 'Spoiled', description: 'Consumables give 25% more benefit (rounded down). When receiving quest rewards, their reward is increased by 10%.' },
            { id: 'lazy', name: 'Lazy', description: 'Rest benefits are doubled, but they roll a 1d5 for training unless sparring.' },
            { id: 'insatiable-potential', name: 'Insatiable Potential', description: 'Roll 2d80+40 when rolling for potential unlocks.' },
            { id: 'space-breathing', name: 'Space Breathing', description: 'Can survive in the vacuum of space.' }
        ],
        type: 'birth'
    },
    'Vampire': {
        name: 'Vampire',
        statMultiplierPoints: 9,
        description: 'An immortal being that feeds on the blood of the living. Gained by drinking a Blood Vial and surviving 24 hours in the shade.',
        abilities: ['Suck Blood', 'Pseudo-Regeneration', 'Shapeshifting'],
        passives: [
            { id: 'not-your-blood', name: 'Not Your Blood', description: 'You rely on the blood of living things. You have a blood bar whose limit is 100+(CON mod*3). If you have no blood in your body for 24 hours, you die.' },
            { id: 'mutated', name: 'Mutated', description: 'You still cherish your original form. Choose 2 abilities to keep from your original race.' },
            { id: 'instant-twitch-muscle-fibers', name: 'Instant Twitch Muscle Fibers', description: 'Your muscles become insanely efficient. Gain +4 STR mod and +4 DEX mod and advantage to CON saving throws.' },
            { id: 'hemophilia', name: 'Hemophilia', description: 'Blood is extremely enticing. When making an entity bleed, heal 8 HP.' },
            { id: 'heliophobic', name: 'Heliophobic', description: 'The sun harasses you. Solar Flare blindness lasts 2 turns longer and negates all buffs gained from vampirism.' },
            { id: 'shapeshifting', name: 'Shapeshifting', description: 'You can change how you look, even copying other people\u2019s appearances.' },
            { id: 'longevity', name: 'Longevity', description: 'You can live for 3x longer than Earthlings.' },
            { id: 'can-doesnt-mean-should', name: 'Can Doesn\u2019t Mean Should', description: 'Trying to scientifically modify your body kills you.' },
            { id: 'pseudo-regeneration', name: 'Pseudo-Regeneration', description: 'You can spend blood in your blood bar to heal equal to 1/4 of the amount spent.' },
            { id: 'abnormal', name: 'Abnormal', description: 'You cannot use recovery capsules or ki capsules, and you do not heal from eating Senzu Beans.' }
        ],
        type: 'method'
    }
};

module.exports = { races };
