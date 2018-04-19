/*
 *  Package  : modules
 *  Filename : api2.js
 *  Create   : 2018-03-13
 */

'use strict';

let [Fetcher] = require('zoj-contest-fetcher');

app.apiRouter.get('/api/outsidecontests', async (req, res) => {
	try {
		let outsideContests = await Fetcher(10);
		res.send(outsideContests);
	} catch (e) {
		zoj.log(e);
		res.send(e);
	}
});

app.apiRouter.post('/api/markdown', async (req, res) => {
	try {
		let s = await zoj.utils.markdown(req.body.s.toString(), null, req.body.noReplaceUI === 'true');
		res.send(s);
	} catch (e) {
		zoj.log(e);
		res.send(e);
	}
});

// APIs for judge client
app.apiRouter.post('/api/judge/peek', async (req, res) => {
	try {
		if (req.query.session_id !== zoj.config.token) return res.status(404).send({ err: 'Permission denied' });

		let WaitingJudge = zoj.model('waiting_judge');
		let JudgeState = zoj.model('judge_state');

		let judge_state;
		await zoj.utils.lock('/api/judge/peek', async () => {
			let waiting_judge = await WaitingJudge.findOne({ order: [['priority', 'ASC'], ['id', 'ASC']] });
			if (!waiting_judge) {
				return;
			}

			if (waiting_judge.type === 'submission') {
				judge_state = await waiting_judge.getJudgeState();
				await judge_state.loadRelationships();
			}
			await waiting_judge.destroy();
		});

		if (judge_state) {
				res.send({
					have_task: 1,
					judge_id: judge_state.id,
					code: judge_state.code,
					language: judge_state.language,
					testdata: judge_state.problem.id,
					type: 'submission'
				});
		} else {
			res.send({ have_task: 0 });
		}
	} catch (e) {
		res.status(500).send(e);
	}
});

app.apiRouter.post('/api/judge/update/:id', async (req, res) => {
	try {
		if (req.query.session_id !== zoj.config.token) return res.status(404).send({ err: 'Permission denied' });

		if (req.body.type === 'submission') {
			let JudgeState = zoj.model('judge_state');
			let judge_state = await JudgeState.fromID(req.params.id);
			await judge_state.updateResult(JSON.parse(req.body.result));
			await judge_state.save();
			await judge_state.updateRelatedInfo();
		}

		res.send({ return: 0 });
	} catch (e) {
		zoj.log(e);
		res.status(500).send(e);
	}
});

app.apiRouter.get('/api/problemdata/:id/:token', async (req, res) => {
	try {
		let token = req.params.token;
		if (token !== zoj.config.token) return res.status(404).send({ err: 'Permission denied' });

		let Problem = zoj.model('problem');

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) return res.status(404).send({ err: 'Permission denied' });

		if (!await zoj.utils.isFile(problem.getTestdataPath() + '.zip')) {
			await problem.makeTestdataZip();
		}
		let path = require('path');
		let filename = problem.getTestdataPath() + '.zip';
		if (!await zoj.utils.isFile(filename)) return res.status(404).send({ err: 'Permission denied' });
		res.download(filename, path.basename(filename));
	} catch (e) {
		res.status(500).send(e);
		zoj.log(e);
	}
});

app.apiRouter.get('/api/problemhash/:id/:token', async (req, res) => {
	try {
		let token = req.params.token;
		if (token !== zoj.config.token) return res.status(404).send({ err: 'Permission denied' });

		let Problem = zoj.model('problem');

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) return res.status(404).send({ err: 'Permission denied' });

		if (problem.testdata_hash == null || problem.testdata_hash == '')
			await problem.updateTestdataHash();
		res.send(problem.testdata_hash);
	} catch (e) {
		res.status(500).send(e);
		zoj.log(e);
	}
});