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
let files = [];

let check = (str) => {
	for (let x of ignore) if (str.indexOf(x) !== -1) return 0;
	return 1;
};

async function listDirAsync(dir) {
	return await new Promise((resolve) => {
		fs.readdir(dir, async function (err, fileList) {
			if (err) {
				console.warn(err);
				resolve({ dirs: [], files: [] });
			} else {
				let dirs = [], files = [];
				fileList = fileList.filter((x) => check(x));
				for (let filename of fileList) {
					var filedir = path.join(dir, filename);
					let info = await new Promise((resolve) => fs.stat(filedir, function (eror, stats) {
						if (eror) {
							resolve(0);
						} else {
							var isFile = stats.isFile();
							var isDir = stats.isDirectory();
							if (isFile) {
								resolve(1);
							} else if (isDir) {
								resolve(2);
							}
						}
					}));
					if (info === 1) {
						files.push(filedir);
					} else if (info === 2) {
						dirs.push(filedir);
					}
				}
				resolve({ dirs: dirs, files: files });
			}
		});
	});
}

async function testFile(filePath) {
	let dirInfo = await listDirAsync(filePath);
	for (let x of dirInfo.files) files.push(x);
	for (let x of dirInfo.dirs) await testFile(x);
}

testFile('.').then(async () => {
	console.log('Total files count: ' + files.length);
	let result = await new Promise(async (resolve) => {
		let errors = [];
		for (let file of files) {
			if (file.endsWith('.ejs')) {
				let text = fs.readFileSync(file);
				let result = ejsLint(text.toString());
				if (result) errors.push({ file: file, message: result });
			} else if (file.endsWith('js')) {
				let lint = new Promise((resolve) => {
					exec(`.\\node_modules\\.bin\\eslint ${file}`, function (error, stdout, stderr) {
						resolve({ error: error, stdout: stdout, stderr: stderr });
					});
				});
				let result = await lint;
				if (result.stdout) errors.push({ file: file, message: result.stdout });
			}
		}
		resolve(errors);
	});
	if (result.length) {
		console.log(`Found ${result.length} error(s)`);
		for (error of result) {
			console.info(`File ${error.file}:`);
			console.error(error.message);
		}
		process.exit(-1);
	}
});