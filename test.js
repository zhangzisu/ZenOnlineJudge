let fs = require('fs');
let path = require('path');
const ejsLint = require('ejs-lint');

let ignore = [
	'node_modules',
	'static',
	'.git',
	'.vscode',
	'.eslintrc.js'
];

var exec = require('child_process').exec;

function testFile(filePath) {
	fs.readdir(filePath, function (err, files) {
		if (err) {
			console.warn(err);
		} else {
			files.forEach(async function (filename) {
				var filedir = path.join(filePath, filename);
				for (let x of ignore) if (filename.indexOf(x) !== -1) return;
				await fs.stat(filedir, async function (eror, stats) {
					if (eror) {
						console.warn(`Cannot access ${filedir}`);
					} else {
						var isFile = stats.isFile();
						var isDir = stats.isDirectory();
						if (isFile) {
							if (filename.endsWith('.js')) {
								console.log(filedir);
								let lint = new Promise((resolve) => {
									exec(`node ./node_modules/.bin/eslint ${filedir}`, function (error) {
										resolve(error);
									});
								});
								let result = await lint;
								console.log(result);
							} else if (filename.endsWith('.ejs')) {
								console.log(filedir);
								let text = fs.readFileSync(filedir);
								let result = ejsLint(text.toString());
								if (result) console.error(result);
							}
						}
						if (isDir) {
							testFile(filedir);
						}
					}
				});
			});
		}
	});
}

testFile('.');