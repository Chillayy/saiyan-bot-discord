# Battle System Guide

## Overview
The battle system implements a turn-based D&D-style combat system for Dragon Ball Z themed battles with initiative, actions, HP tracking, death saves, and all the mechanics outlined in your comments.

## Starting a Battle

Use `/battle-start` with participant stats:

```
/battle-start
  participant1: @User1
  hp1: 100
  str1: 15
  dex1: 14
  con1: 16
  wil1: 12
  participant2: @User2
  hp2: 120
  str2: 18
  dex2: 12
  con2: 14
  wil2: 10
```

The bot will:
1. Roll initiative (d50) for each participant
2. Display turn order
3. Announce whose turn it is first

## Combat Flow

### Your Turn
On your turn, you have:
- **1 Action** - Main attack or special ability
- **1 Bonus Action** - Secondary attack or ability

### Attacking

Use `/battle-attack` to attack an opponent:

```
/battle-attack
  target: @Opponent
  attacktype: Physical or Ki-Based
  isaction: true (for Action) or false (for Bonus Action)
```

**Attack Resolution:**
1. **Attack Roll:** Attacker rolls 1d20 + DEX modifier
2. **Defense Roll:** Defender rolls 1d20 + DEX modifier
3. **Outcome:**
   - Attacker rolls higher OR defender rolls NAT 1 → **HIT LANDS**
   - Attacker rolls lower OR attacker rolls NAT 1 → **Block/Dodge sequence**
   - Both roll same → **CLASH**

**Block/Dodge Sequence:**
- Both roll 1d20 + DEX again
- If attacker crit failed: -5 to their roll
- If defender crit succeeded: +5 to their roll
- Attacker higher → **BLOCKED** (80% damage reduction)
- Defender higher/equal → **DODGED** (no damage)

**Damage Calculation:**
- Roll 1d5 + STR/WIL modifier
- NAT 20 on attack roll: +5 damage (Critical Hit)
- Blocked attacks: damage × 0.2 (rounded down)

**Limb Break/Removal:**
- If damage roll is NAT 5 (max roll), attempt limb break
- Attacker rolls 1d20 (or 1d18 for head) + STR/WIL
- Defender rolls CON save: 1d35+CON (if blocked) or 1d25+CON (if not)
- If attacker wins: limb is broken (blunt) or sliced off (slash)

### Critical Hits
- **NAT 20 on attack roll** = +5 bonus damage

### Advancing Turn

When you've used both actions (or want to end turn early):
```
/battle-next
```

This advances to the next combatant in initiative order.

## Battle Commands

### `/battle-status`
View current battle state:
- Current round
- Whose turn it is
- All participants' HP, Ki, Fatigue
- Status effects (incapacitated, dead)
- Broken limbs
- Available actions

### `/battle-retreat`
Attempt to escape from battle:
```
/battle-retreat opponent: @Enemy
```

**Retreat Roll:**
- You roll 1d20
- Must beat: Opponent's 1d20 + their DEX modifier
- **Success:** Escape to random area (1-1000)
- **Failure:** Lose full turn + disadvantage on all rolls until end of next turn

### `/battle-save`
Save an incapacitated ally (uses your Action):
```
/battle-save ally: @IncapacitatedAlly
```

- Ally automatically succeeds one death save
- 2 successful saves = Stable (no longer needs death saves)

### `/battle-end`
Manually end the battle in the current channel (for GM/cleanup).

## Death & Incapacitation

### Knocked Out (HP ≤ 0)
When your HP drops to 0 or below:
- You become **INCAPACITATED**
- On your turn, you must roll a **DEATH SAVE** (automatically done when you use `/battle-next`)

### Death Saves
- Roll 1d20 each turn
- **Success:** Roll > 8
- **Failure:** Roll ≤ 8
- **2 Successes:** Stable (still incapacitated but safe)
- **3 Failures:** DEAD

### While Incapacitated
- Enemies can target you with guaranteed hits
- If hit, roll CON save (1d20+CON)
- **Failed save (< 15):** Gain 1 failed death save
- **Passed save (≥ 15):** No penalty

## Combat Mechanics

### Initiative
- Everyone rolls 1d50 at battle start
- Highest goes first, descending order
- Resets each round but order stays the same

### Actions
- **Action:** Primary attack, major ability, save ally
- **Bonus Action:** Secondary attack, minor ability

### Disadvantage
- Roll attack twice, take the LOWER result
- Applied when retreat fails
- Lasts until end of next turn

### Status Effects
- **Broken Limbs:** Tracked but penalties applied by GM
- **Incapacitated:** Can't act, must make death saves
- **Dead:** Out of combat permanently

## Example Battle Flow

```
Round 1:
Player A (Initiative 45) - It's your turn!
  → /battle-attack target:@PlayerB attacktype:Physical isaction:true
  → [Bot shows attack results]
  → /battle-next

Player B (Initiative 32) - It's your turn!
  → /battle-attack target:@PlayerA attacktype:Ki isaction:true
  → [Bot shows attack results]
  → /battle-attack target:@PlayerA attacktype:Physical isaction:false
  → [Bot shows attack results]
  → /battle-next

Round 2:
Player A - It's your turn!
  → /battle-status (check HP)
  → /battle-retreat opponent:@PlayerB
  → [Attempt escape...]
```

## Tips

1. **Check Status Often:** Use `/battle-status` to see everyone's HP
2. **Plan Actions:** You get ONE action + ONE bonus action per turn
3. **Track Initiative:** The bot shows whose turn it is
4. **Death Saves:** When incapacitated, your turn auto-rolls death saves
5. **Retreat Early:** If losing, retreat before HP hits 0
6. **Save Allies:** Use your action to stabilize dying teammates

## Multi-Combatant Battles

The system supports more than 2 participants! You can:
- Have teams (coordinate who attacks whom)
- Free-for-all battles
- NPC enemies (GM controls their turns)

Simply add participants when starting battle and coordinate targets during attacks.

## Notes

- Battles are channel-specific (one battle per channel)
- All dice rolls are automated and shown
- Math is calculated automatically
- Combat follows D&D 5e-style mechanics with Dragon Ball theming
- Stats use STR, DEX, CON, WIL modifiers calculated as: (stat - 10) / 2
