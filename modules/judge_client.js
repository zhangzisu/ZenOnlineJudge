'use strict';

let app = require('express')();
let server = null;
if (zoj.config.https) {
	let https = require('https');
	let fs = require('fs');
	var options = {
		key: fs.readFileSync(zoj.config.https_config.key),
		cert: fs.readFileSync(zoj.config.https_config.cert)
	};
	server = https.createServer(options, app);
} else {
	let http = require('http');
	server = http.createServer(app);
}
let io = require('socket.io').listen(server);

app.get('/', function (req, res) {
	res.send('<a href="https://zhangzisu.cn">Server status: All Clear</a>');
});

let ss = require('socket.io-stream');
let fs = require('fs-extra');
let WaitingJudge = zoj.model('waiting_judge');
let JudgeState = zoj.model('judge_state');
let Problem = zoj.model('problem');

global.judge_client = {
	judgers: new Set(),
	ids: new Map(),
	status: {
		free: new Set(),
		busy: new Set()
	}
};

let tasked = new Set();

io.sockets.on('connection', function (socket) {
	socket.on('connection', function () {
		//
	});
	socket.on('login', function (data) {
		if (data.token !== zoj.config.token) {
			// Token incorrect, force disconnect.
			socket.emit('terminate', {});
			socket.disconnect();
			return;
		}
		let id = parseInt(data.id) || 0;
		if (judge_client.judgers.has(id)) {
			// Registeration failed.
			socket.disconnect();
			return;
		}
		judge_client.judgers.add(id);
		judge_client.ids[socket.id = id] = socket;
		zoj.log(`Client ${id} connected.`);
	});
	socket.on('disconnect', function () {
		let id = socket.id;
		zoj.log(`Client ${id} disconnected.`);
		if (tasked.has(id)) tasked.delete(id);
		if (judge_client.judgers.has(id)) judge_client.judgers.delete(id);
		if (judge_client.ids.has(id)) judge_client.ids.delete(id);
		if (judge_client.status.free.has(id)) judge_client.status.free.delete(id);
		if (judge_client.status.busy.has(id)) judge_client.status.busy.delete(id);
	});
	socket.on('free', async function () {
		let id = socket.id;
		if (tasked.has(id)) return;
		tasked.add(id);
		if (judge_client.status.busy.has(id)) judge_client.status.busy.delete(id);
		judge_client.status.free.add(id);

		try {
			let judge_state;
			await zoj.utils.lock('judge_peek', async () => {
				let waiting_judge = await WaitingJudge.findOne({
					order: [
						['priority', 'ASC'],
						['id', 'ASC']
					]
				});
				if (!waiting_judge) {
					return;
				}

				judge_state = await waiting_judge.getJudgeState();
				await judge_state.loadRelationships();
				await waiting_judge.destroy();
			});

			if (judge_state) {
				let problem = await Problem.fromID(judge_state.problem.id);
				if (problem.testdata_hash == null || problem.testdata_hash == '')
					await problem.updateTestdataHash();
				socket.emit('task', {
					judge_id: judge_state.id,
					code: judge_state.code,
					language: judge_state.language,
					pid: judge_state.problem.id,
					datahash: problem.testdata_hash,
					config: problem.datainfo
				});
			} else {
				if (tasked.has(id)) tasked.delete(id);
			}
		} catch (e) {
			zoj.error(e);
			socket.emit('terminate', {});
		}
	});
	socket.on('busy', function () {
		let id = socket.id;
		if (judge_client.status.free.has(id)) judge_client.status.free.delete(id);
		judge_client.status.busy.add(id);
		if (tasked.has(id)) tasked.delete(id);
	});
	socket.on('update', async function (data) {
		try {
			await zoj.utils.lock('judge_update', async () => {
				let judge_state = await JudgeState.fromID(data.judge_id);
				if (!judge_state) throw null;
				await judge_state.updateResult(data.result);
				await judge_state.save();
				await judge_state.updateRelatedInfo();
			});
		} catch (e) {
			zoj.error(e);
			socket.emit('terminate', {});
		}
	});
	socket.on('require_data', async function (data) {
		try {
			let problem = await Problem.fromID(data.pid);
			if (!problem) throw null;
			if (!await zoj.utils.isFile(problem.getTestdataPath() + '.zip')) {
				await problem.makeTestdataZip();
			}
			let filename = problem.getTestdataPath() + '.zip';
			if (!await zoj.utils.isFile(filename)) throw null;
			zoj.log(`Require data: ${data.pid}`);
			var stream = ss.createStream();
			ss(socket).emit('file', stream);
			fs.createReadStream(filename).pipe(stream).on('finish', function () {
				zoj.log('Data upload succeed.');
			});
		} catch (e) {
			zoj.error(e);
			socket.emit('terminate', {});
		}
	});
});

server.listen(zoj.config.callback_port, function () {
	zoj.log('Judge Client Service started successfully.');
});