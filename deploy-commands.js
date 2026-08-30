// Deploy-commands.js
// Registers ALL slash commands with Discord. The command builders are constructed and collected
// by index.js (see `registerCommand`/`COMMANDS_TO_DEPLOY`), which then pushes them to Discord in
// `deployCommands()` (guild-scoped for fast sync, or globally). Running this script connects the
// bot, lets index.js deploy every command, then exits.
//
// Run with: node deploy-commands.js
//
// Note: index.js also deploys automatically whenever the bot starts, so this is a convenience for
// force-refreshing commands without keeping the bot running.

const { token } = require('./.gitignore/config.json');
const { client, COMMANDS_TO_DEPLOY, deployCommands } = require('./index');

client.once('ready', async () => {
    try {
        // index.js's ClientReady handler (registered first) builds every command; wait for it.
        const start = Date.now();
        while (COMMANDS_TO_DEPLOY.length === 0 && Date.now() - start < 15000) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (COMMANDS_TO_DEPLOY.length === 0) {
            console.error('❌ No commands were built for deployment.');
            process.exit(1);
        }
        await deployCommands();
        console.log(`✅ Deployed ${COMMANDS_TO_DEPLOY.length} commands. Exiting.`);
        await client.destroy().catch(() => {});
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to deploy commands:', err && err.message ? err.message : err);
        await client.destroy().catch(() => {});
        process.exit(1);
    }
});

client.login(token).catch(err => {
    console.error('❌ Failed to login:', err && err.message ? err.message : err);
    process.exit(1);
});