let fs = require('fs-extra');
let conif = require('node-console-input');

function u(key, value) {
    key = value === '' ? key : value;
}

module.exports = function () {
    let config = JSON.parse(fs.readFileSync('config.example.json')), result;
    result = conif.getConsoleInput("Site title: ", true).trim();
    u(config.title, result);
    result = conif.getConsoleInput("Listen address: ", true).trim();
    u(config.listen, result);
    result = conif.getConsoleInput("Listen port: ", true).trim();
    u(config.port, result);
    result = conif.getConsoleInput("Enable HTTPS? y/n: ", true).trim();
    if (result === 'y') {
        config.https = true;
        config.https_config.key = conif.getConsoleInput("HTTPS Key file: ", true).trim();
        config.https_config.cert = conif.getConsoleInput("HTTPS Cert file: ", true).trim();
    }
    result = conif.getConsoleInput("Database type (mysql, sqlite): ", true).trim();
    if (result === 'mysql') {
        config.db.dialect = "mysql";
        config.db.database = conif.getConsoleInput("Mysql database name: ", true).trim();
        config.db.username = conif.getConsoleInput("Mysql database username: ", true).trim();
        config.db.password = conif.getConsoleInput("Mysql database password: ", true).trim();
        config.db.host = conif.getConsoleInput("Mysql server address: ", true).trim();
    } else if (result === 'sqlite') {
        config.db.dialect = "sqlite";
        config.db.storage = conif.getConsoleInput("Database file place: ", true).trim();
    }

    result = conif.getConsoleInput("ZOJ Token: ", true).trim();
    config.token = config.secret = result;
    fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));
    return config;
}