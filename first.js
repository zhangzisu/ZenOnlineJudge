let fs = require('fs-extra');

module.exports = async function () {
    await fs.writeFileSync('config.json', fs.readFileSync('config.example.json'));
}