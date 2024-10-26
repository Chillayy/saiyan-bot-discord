const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

const rest = new REST().setToken(token);

// for global commands
rest.delete(Routes.applicationCommand(clientId, '1298425852362756137'))
	.then(() => console.log('Successfully deleted application command'))
	.catch(console.error);