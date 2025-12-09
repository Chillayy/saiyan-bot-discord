# Saiyan Bot

A Discord bot for a Dragon Ball-themed RPG system.

## Setup Instructions

### 1. Get Your Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot" if you haven't already
5. Click "Reset Token" and copy your bot token
6. **IMPORTANT:** Enable these Privileged Gateway Intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT

### 2. Get Your IDs

- **Client ID**: Found on the "General Information" page of your application
- **Guild ID** (Server ID): 
  1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
  2. Right-click your server and select "Copy Server ID"

### 3. Configure the Bot

Edit `.gitignore/config.json` and replace:
- `YOUR_DISCORD_BOT_TOKEN_HERE` with your bot token
- `YOUR_CLIENT_ID_HERE` with your client ID
- `YOUR_GUILD_ID_HERE` with your server ID

### 4. Invite the Bot to Your Server

1. Go to OAuth2 > URL Generator in the Developer Portal
2. Select these scopes:
   - `bot`
   - `applications.commands`
3. Select these bot permissions:
   - Send Messages
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Bot

```bash
node index.js
```

## Available Commands

- `/ping` - Replies with "Pong!"
- `/hello [user]` - Says hello to a user
- `/fish` - Try to catch fish (random loot with durability mechanics)
- `/rest` - Regain HP, Ki, and reduce Fatigue
- `/search [hera]` - Search for items, missions, merchants, or mentors
- `/calculate` - Calculate power level from character stats (str, dex, con, wil, spi, int, maxhp, maxki)
- `/enemy [powerlevel] [type]` - Generate enemies to fight
  - Types: `casual`, `hard`, `very hard`, `mentor`, `boss`

## Features

- **Fishing System**: Catch fish of varying sizes with different stat bonuses
- **Rest System**: Random HP, Ki, and Fatigue recovery
- **Search System**: Find items, merchants, missions, mentors, and legendary loot
- **Power Level Calculator**: Calculate character power from 8 different stats
- **Enemy Generator**: Create scaled enemies based on power level and difficulty

## Notes

- The bot automatically registers slash commands when it starts
- Commands are available immediately after the bot logs in
- Hera character gets +10 bonus to search rolls
