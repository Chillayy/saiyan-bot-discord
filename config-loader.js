// ---------------------------------------------------------------------------
// Configuration loader.
//
// The bot's tunables ship with the repo; the Discord credentials stay on each machine. The config
// is therefore loaded in layers, later layers winning:
//
//   1. config/default-config.json   committed — the shipped defaults for every host
//   2. config/config.json           optional, gitignored — per-machine tuning overrides
//   3. config/secrets.json          optional, gitignored — token / clientId / guildId
//   4. environment variables        DISCORD_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID
//
// Plain objects merge recursively, so a partial override (e.g. just `android.maxClones`) keeps the
// rest of that block; arrays and scalars are replaced. The result is cached on first load, keeping
// the bot's long-standing "config is read at startup — restart to apply" behaviour.
//
// A new host only needs config/default-config.json (already in the repo) plus their own
// config/secrets.json — copy config/secrets.example.json and paste their bot's token.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, 'config');
const FILES = {
    defaults: path.join(CONFIG_DIR, 'default-config.json'),
    overrides: path.join(CONFIG_DIR, 'config.json'),
    secrets: path.join(CONFIG_DIR, 'secrets.json')
};
// Instance identity lives outside the committed config: the token is secret, and the ids belong to
// whoever's Discord application is running.
const ENV_KEYS = { token: 'DISCORD_TOKEN', clientId: 'DISCORD_CLIENT_ID', guildId: 'DISCORD_GUILD_ID' };

let cached = null;

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Recursive merge: objects merge key-by-key, everything else is taken from the override.
function mergeConfig(base, override) {
    if (!isPlainObject(override)) return override === undefined ? base : override;
    const out = isPlainObject(base) ? { ...base } : {};
    Object.entries(override).forEach(([key, value]) => {
        out[key] = isPlainObject(value) && isPlainObject(out[key]) ? mergeConfig(out[key], value) : value;
    });
    return out;
}

function readJsonFile(file, label) {
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error(`[config] ${path.relative(__dirname, file)} is not valid JSON: ${e.message}`);
        return null;
    }
}

function loadConfig() {
    if (cached) return cached;

    const defaults = readJsonFile(FILES.defaults, 'defaults');
    if (!defaults) {
        throw new Error('config/default-config.json is missing — restore it (git checkout -- config/default-config.json) or copy config/default-config.example.json to config/default-config.json');
    }

    let config = mergeConfig({}, defaults);
    const overrides = readJsonFile(FILES.overrides, 'overrides');
    if (overrides) config = mergeConfig(config, overrides);
    const secrets = readJsonFile(FILES.secrets, 'secrets');
    if (secrets) config = mergeConfig(config, secrets);

    // Environment variables win over every file, so a deployment can keep credentials out of files
    // entirely (systemd EnvironmentFile, Docker secrets, CI variables, ...).
    Object.entries(ENV_KEYS).forEach(([key, envName]) => {
        if (process.env[envName]) config[key] = process.env[envName];
    });

    cached = config;
    return cached;
}

module.exports = { loadConfig, mergeConfig, FILES, ENV_KEYS };
