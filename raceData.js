// Race data extracted from Trello board
const races = {
    'Saiyan': {
        name: 'Saiyan',
        description: 'Saiyans are very similar in appearance to Human-type Earthlings with monkey-like tails.',
        classes: ['Low Class', 'Mid Class', 'Elite Class'],
        abilities: ['Warrior Race', 'Zenkai Boost', 'Great Ape Transformation'],
        type: 'birth'
    },
    'Half-Saiyan': {
        name: 'Half-Saiyan',
        description: 'Half-Saiyans are generally identical to Saiyans but sometimes lack tails. Under stress, they exhibit their human side.',
        abilities: ['Hybrid Potential', 'Adaptive Combat'],
        type: 'birth'
    },
    'Earthling': {
        name: 'Earthling',
        description: 'Every living being from Planet Earth, with certain abilities in common.',
        abilities: ['Masters of Ki', 'Adaptive Learning', 'Resilient Spirit'],
        type: 'birth'
    },
    'Frost Demon': {
        name: 'Frost Demon',
        description: 'Bipedal humanoids with red eyes and white keratinous plating covering scaly reptilian skin.',
        abilities: ['Natural Armor', 'Multiple Forms', 'Cold Resistance'],
        type: 'birth'
    },
    'Namekian': {
        name: 'Namekian',
        description: 'Humanoids with slug-like characteristics, including antennae and light green skin.',
        abilities: ['Regeneration', 'Fusion', 'Heightened Hearing', 'Dragon Clan/Warrior Clan'],
        type: 'birth'
    },
    'Cerealian': {
        name: 'Cerealian',
        description: 'Anthropomorphic aliens similar to Earthlings, with green hair and an evolved right eye.',
        abilities: ['Enhanced Vision', 'Precision Strike'],
        type: 'birth'
    },
    'Konatsian': {
        name: 'Konatsian',
        description: 'Humanoid appearance with varying skin tones and mystical affinity.',
        abilities: ['Mystical Heritage', 'Sword Mastery'],
        type: 'birth'
    },
    'Tuffle': {
        name: 'Tuffle',
        description: 'Small in stature with large brains and advanced technology affinity.',
        abilities: ['Technological Genius', 'Machine Interface'],
        type: 'birth'
    },
    'Oni': {
        name: 'Oni',
        description: 'Muscular builds with horns, sharp claws, and varying skin tones.',
        abilities: ['Natural Weapons', 'Intimidating Presence', 'Demonic Heritage'],
        type: 'birth'
    },
    'Hera': {
        name: 'Hera',
        description: 'Humanoid with teal skin tones and orange hair.',
        abilities: ['Heran Strength', 'Battle Instinct'],
        bonuses: { search: 10 },
        type: 'birth'
    },
    'Tortle': {
        name: 'Tortle',
        description: 'Wise humanoid turtles with deep connection to nature.',
        abilities: ['Natural Armor', 'Shell Defense', 'Ancient Wisdom'],
        type: 'birth'
    },
    'Alien': {
        name: 'Alien',
        description: 'Anything not specifically listed. Custom abilities must be approved.',
        abilities: ['Custom (1-3 abilities)'],
        type: 'birth'
    },
    'Android': {
        name: 'Android',
        description: 'Artificial beings with mechanical enhancements.',
        abilities: ['Unlimited Energy', 'Mechanical Body', 'Self-Repair'],
        type: 'method'
    },
    'Bio-Android': {
        name: 'Bio-Android',
        description: 'Biological constructs with absorbed abilities.',
        abilities: ['Absorption', 'Regeneration', 'Adaptive DNA'],
        type: 'method'
    },
    'Majin': {
        name: 'Majin',
        description: 'Magical beings with incredible regeneration and transformation.',
        abilities: ['Magical Nature', 'Regeneration', 'Absorption', 'Body Manipulation'],
        type: 'method'
    }
};

module.exports = { races };
