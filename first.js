let fs = require('fs-extra');
let conif = require('node-console-input');

module.exports = function () {
	let config = JSON.parse(fs.readFileSync('config.example.json')), result, enableOptional;
	config.title = conif.getConsoleInput('Site title: ').trim();
	config.listen = conif.getConsoleInput('Listen address: ').trim();
	config.port = conif.getConsoleInput('Listen port: ').trim();

	result = conif.getConsoleInput('Enable HTTPS? y/n: ').trim();
	if (result === 'y') {
		config.https = true;
		config.https_config.key = conif.getConsoleInput('HTTPS Key file: ').trim();
		config.https_config.cert = conif.getConsoleInput('HTTPS Cert file: ').trim();
	}
	config.hostname = (config.https ? 'https://' : 'http://') + config.listen;
	if (config.port !== (config.https ? '443' : '80')) config.hostname = config.hostname + `:${config.port}`;
	result = conif.getConsoleInput('Database type (mysql, sqlite): ').trim();
	if (result === 'mysql') {
		config.db.dialect = 'mysql';
		config.db.database = conif.getConsoleInput('Mysql database name: ').trim();
		config.db.username = conif.getConsoleInput('Mysql database username: ').trim();
		config.db.password = conif.getConsoleInput('Mysql database password: ').trim();
		config.db.host = conif.getConsoleInput('Mysql server address: ').trim();
		enableOptional = false;
	} else if (result === 'sqlite') {
		config.db.dialect = 'sqlite';
		config.db.storage = conif.getConsoleInput('Database file place: ').trim();
		enableOptional = true;
	}

	result = conif.getConsoleInput('ZOJ Token: ').trim();
	config.token = config.secret = result;
	fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));
	let upgrade = 'git fetch --all && git reset --hard origin/master\n';
	if (enableOptional) upgrade += 'npm install --production\n';
	else upgrade += 'npm install --production --no-optional\n';
	upgrade += 'killall node\nnode app.js >log.txt';
	fs.writeFileSync('upgrade.sh', upgrade);
	return config;
};