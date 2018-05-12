'use strict';

let Contest = zoj.model('contest');
let ContestRanklist = zoj.model('contest_ranklist');
let ContestPlayer = zoj.model('contest_player');
let Problem = zoj.model('problem');
let JudgeState = zoj.model('judge_state');
let User = zoj.model('user');

app.get('/contests', async (req, res) => {
	try {
		let where;
		if (res.locals.user && await res.locals.user.admin >= 3) where = {}
		else if (res.locals.user && await res.locals.user.admin >= 1) where = { is_public: true };
		else where = { $and: { is_public: true, is_protected: false } };

		let paginate = zoj.utils.paginate(await Contest.count(where), req.query.page, zoj.config.page.contest);
		let contests = await Contest.query(paginate, where, [['start_time', 'desc']]);

		await contests.forEachAsync(async x => x.subtitle = await zoj.utils.markdown(x.subtitle));

		res.render('contests', {
			contests: contests,
			paginate: paginate
		})
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user || !res.locals.user.admin >= 3) throw new ErrorMessage('You do not have permission to do this.');

		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);
		if (!contest) {
			contest = await Contest.create();
			contest.id = 0;
		}

		let problems = JSON.stringify(contest.problems, null, '\t');

		res.render('contest_edit', {
			contest: contest,
			problems: problems
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/contest/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user || !res.locals.user.admin >= 3) throw new ErrorMessage('You do not have permission to do this.');

		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);
		if (!contest) {
			contest = await Contest.create();

			contest.holder_id = res.locals.user.id;

			let ranklist = await ContestRanklist.create();
			await ranklist.save();
			contest.ranklist_id = ranklist.id;
		}

		if (!req.body.title.trim()) throw new ErrorMessage('Title cannot be empty.');
		contest.title = req.body.title;
		contest.subtitle = req.body.subtitle;
		let np = JSON.parse(req.body.problems), xp = [], rsh = false;
		for (var p of np) {
			if (p.id && await Problem.fromID(p.id)) xp.push(p);
		}
		np = xp;
		if (contest.problems !== np) {
			contest.problems = np;
			rsh = true;
		}
		contest.information = req.body.information;
		contest.start_time = zoj.utils.parseDate(req.body.start_time);
		contest.end_time = zoj.utils.parseDate(req.body.end_time);
		contest.is_public = req.body.is_public === 'on';
		contest.is_protected = req.body.is_protected == 'on';
		contest.type = req.body.type;

		await contest.save();

		if (rsh) {
			let players = await ContestPlayer.query(null, { contest_id: contest.id });
			for (var x of players) x.refreshScore();
		}

		res.redirect(zoj.utils.makeUrl(['contest', contest.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id', async (req, res) => {
	try {
		let contest_id = parseInt(req.params.id);

		let contest = await Contest.fromID(contest_id);
		if (!contest) throw new ErrorMessage('No such contest.');
		if (!contest.is_public && (!res.locals.user || !res.locals.user.admin >= 3)) throw new ErrorMessage('No such contest.');

		contest.allowedEdit = await contest.isAllowedEditBy(res.locals.user);
		contest.running = await contest.isRunning();
		contest.ended = await contest.isEnded();
		contest.subtitle = await zoj.utils.markdown(contest.subtitle);
		contest.information = await zoj.utils.markdown(contest.information);

		let problemset = await contest.getProblems();
		let problems = await problemset.mapAsync(async obj => await Problem.fromID(obj.id));

		let player = null;

		if (res.locals.user) {
			player = await ContestPlayer.findInContest({
				contest_id: contest.id,
				user_id: res.locals.user.id
			});
		}

		problems = problems.map(x => ({ problem: x, status: null, judge_id: null, statistics: null }));
		if (player) {
			for (let problem of problems) {
				if (contest.type === 'noi') {
					if (player.score_details[problem.problem.id]) {
						let judge_state = await JudgeState.fromID(player.score_details[problem.problem.id].judge_id);
						problem.status = judge_state.status;
						if (!contest.ended && !await problem.problem.isAllowedEditBy(res.locals.user) && !['Compile Error', 'Waiting', 'Compiling'].includes(problem.status)) {
							problem.status = 'Submitted';
						}
						problem.judge_id = player.score_details[problem.problem.id].judge_id;
					}
				} else if (contest.type === 'ioi') {
					if (player.score_details[problem.problem.id]) {
						let judge_state = await JudgeState.fromID(player.score_details[problem.problem.id].judge_id);
						problem.status = judge_state.status;
						problem.judge_id = player.score_details[problem.problem.id].judge_id;
					}
				} else if (contest.type === 'acm') {
					if (player.score_details[problem.problem.id]) {
						problem.status = {
							accepted: player.score_details[problem.problem.id].accepted,
							unacceptedCount: player.score_details[problem.problem.id].unacceptedCount
						};
						problem.judge_id = player.score_details[problem.problem.id].judge_id;
					} else {
						problem.status = null;
					}
				}
			}
		}

		let hasStatistics = false;
		if (contest.ended || (res.locals.user && res.locals.user.admin >= 3)) {
			hasStatistics = true;

			await contest.loadRelationships();
			let players = await contest.ranklist.getPlayers();
			for (let problem of problems) {
				problem.statistics = { attempt: 0, accepted: 0 };

				if (contest.type === 'ioi' || contest.type === 'noi') {
					problem.statistics.partially = 0;
				}

				for (let player of players) {
					if (player.score_details[problem.problem.id]) {
						problem.statistics.attempt++;
						if ((contest.type === 'acm' && player.score_details[problem.problem.id].accepted)
							|| ((contest.type === 'noi' || contest.type === 'ioi') && player.score_details[problem.problem.id].score === 100)) {
							problem.statistics.accepted++;
						}

						if ((contest.type === 'noi' || contest.type === 'ioi') && player.score_details[problem.problem.id].score > 0) {
							problem.statistics.partially++;
						}
					}
				}
			}
		}

		res.render('contest', {
			contest: contest,
			problems: problems,
			hasStatistics: hasStatistics
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/ranklist', async (req, res) => {
	try {
		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);

		if (!contest) throw new ErrorMessage('No such contest.');
		if (!await contest.isAllowedSeeResultBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		await contest.loadRelationships();

		let players_id = [];
		for (let i = 1; i <= contest.ranklist.ranklist.player_num; i++) players_id.push(contest.ranklist.ranklist[i]);

		let ranklist = await players_id.mapAsync(async player_id => {
			let player = await ContestPlayer.fromID(player_id);
			for (let i in player.score_details) {
				player.score_details[i].judge_state = await JudgeState.fromID(player.score_details[i].judge_id);
			}

			let user = await User.fromID(player.user_id);

			return {
				user: user,
				player: player
			};
		});

		let problems_id = await contest.getProblems();
		let problems = await problems_id.mapAsync(async obj => await Problem.fromID(obj.id));

		res.render('contest_ranklist', {
			contest: contest,
			ranklist: ranklist,
			problems: problems
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/submissions', async (req, res) => {
	try {
		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);

		if (!contest) throw new ErrorMessage('No such contest.');
		if (!await contest.isAllowedSeeResultBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		contest.ended = await contest.isEnded();

		let problems_id = await contest.getProblems();
		problems_id = await problems_id.mapAsync(x => (x.id));

		let user = await User.fromName(req.query.submitter || '');
		let where = {};
		if (user) where.user_id = user.id;
		if (req.query.problem_id) where.problem_id = problems_id[parseInt(req.query.problem_id) - 1];
		where.type = 1;
		where.type_info = contest_id;

		if (contest.ended || (res.locals.user && res.locals.user.admin >= 3)) {
			if (!((!res.locals.user || !res.locals.user.admin >= 3) && !contest.ended && contest.type === 'acm')) {
				let minScore = parseInt(req.query.min_score);
				if (isNaN(minScore)) minScore = 0;
				let maxScore = parseInt(req.query.max_score);
				if (isNaN(maxScore)) maxScore = 100;

				where.score = {
					$and: {
						$gte: parseInt(minScore),
						$lte: parseInt(maxScore)
					}
				};
			}

			if (req.query.language) where.language = req.query.language;
			if (req.query.status) where.status = { $like: req.query.status + '%' };
		}

		let paginate = zoj.utils.paginate(await JudgeState.count(where), req.query.page, zoj.config.page.judge_state);
		let judge_state = await JudgeState.query(paginate, where, [['submit_time', 'desc']]);

		await judge_state.forEachAsync(async obj => obj.allowedSeeCode = await obj.isAllowedSeeCodeBy(res.locals.user));
		await judge_state.forEachAsync(async obj => {
			await obj.loadRelationships();
			obj.problem_id = problems_id.indexOf(obj.problem_id) + 1;
			obj.problem.title = zoj.utils.removeTitleTag(obj.problem.title);

			if (contest.type === 'noi' && !contest.ended && !await obj.problem.isAllowedEditBy(res.locals.user)) {
				if (!['Compile Error', 'Waiting', 'Compiling'].includes(obj.status)) {
					obj.status = 'Submitted';
				}
			}
		});

		res.render('contest_submissions', {
			contest: contest,
			judge_state: judge_state,
			paginate: paginate,
			form: req.query
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/estimate', async (req, res) => {
	try {
		if (!res.locals.user) throw new ErrorMessage('Please login.');
		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);
		if (!contest) throw new ErrorMessage('No such contest.');
		if (!contest.is_public && (!res.locals.user || !res.locals.user.admin >= 3)) throw new ErrorMessage('No such contest.');

		let problemset = await contest.getProblems();
		let problems = await problemset.mapAsync(async obj => await Problem.fromID(obj.id));

		let player = await ContestPlayer.findInContest({
			contest_id: contest.id,
			user_id: res.locals.user.id
		});

		for (var p of problems) {
			if (!player.score_details[p.id].self) {
				player.score_details[p.id].self = {
					score: 0,
					time: 0
				};
			}
		}

		res.render('estimate', {
			player: player,
			problems: problems,
			contest: contest
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/contest/:id/estimate', async (req, res) => {
	try {
		if (!res.locals.user) throw new ErrorMessage('Please login.');
		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);
		if (!contest) throw new ErrorMessage('No such contest.');
		if (!contest.is_public && (!res.locals.user || !res.locals.user.admin >= 3)) throw new ErrorMessage('No such contest.');

		let problemset = await contest.getProblems();
		let problems = await problemset.mapAsync(async obj => await Problem.fromID(obj.id));

		let player = await ContestPlayer.findInContest({
			contest_id: contest.id,
			user_id: res.locals.user.id
		});

		for (var p of problems) {
			let scoreName = `s_${p.id}`;
			let timeName = `t_${p.id}`;
			if (req.body[scoreName] && req.body[timeName]) {
				await player.updateSelfInfo(p.id, req.body[scoreName], req.body[timeName]);
			}
		}

		await player.save();

		res.redirect(zoj.utils.makeUrl(['contest', contest_id, 'estimate']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/:pid', async (req, res) => {
	try {
		let contest_id = parseInt(req.params.id);
		let contest = await Contest.fromID(contest_id);
		if (!contest) throw new ErrorMessage('No such contest.');

		if (!contest.is_public && (!res.locals.user || !res.locals.user.admin >= 3)) throw new ErrorMessage('No such contest.');

		let problems_id = await contest.getProblems();
		problems_id = await problems_id.mapAsync(x => (x.id));

		let pid = parseInt(req.params.pid);
		if (!pid || pid < 1 || pid > problems_id.length) throw new ErrorMessage('No such problem.');

		let problem_id = problems_id[pid - 1];
		let problem = await Problem.fromID(problem_id);
		await problem.loadRelationships();

		contest.ended = await contest.isEnded();
		if (!(await contest.isRunning() || contest.ended)) {
			if (await problem.isAllowedUseBy(res.locals.user)) {
				return res.redirect(zoj.utils.makeUrl(['problem', problem_id]));
			}
			throw new ErrorMessage('Contest has not started yet.');
		}

		problem.content = await zoj.utils.markdown(problem.content);

		let state = await problem.getJudgeState(res.locals.user, false);

		await problem.loadRelationships();

		res.render('problem', {
			pid: pid,
			contest: contest,
			problem: problem,
			state: state,
			lastLanguage: res.locals.user ? await res.locals.user.getLastSubmitLanguage() : null
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/contest/:id/:pid/download/additional_file', async (req, res) => {
	try {
		let id = parseInt(req.params.id);
		let contest = await Contest.fromID(id);
		if (!contest) throw new ErrorMessage('No such contest.');

		let problems_id = await contest.getProblems();
		problems_id = await problems_id.mapAsync(x => (x.id));

		let pid = parseInt(req.params.pid);
		if (!pid || pid < 1 || pid > problems_id.length) throw new ErrorMessage('No such problem.');

		let problem_id = problems_id[pid - 1];
		let problem = await Problem.fromID(problem_id);

		contest.ended = await contest.isEnded();
		if (!(await contest.isRunning() || contest.ended)) {
			if (await problem.isAllowedUseBy(res.locals.user)) {
				return res.redirect(zoj.utils.makeUrl(['problem', problem_id, 'download', 'additional_file']));
			}
			throw new ErrorMessage('Contest has not started yet.');
		}

		await problem.loadRelationships();

		if (!problem.additional_file) throw new ErrorMessage('No such file.');

		console.log(`additional_file_${id}_${pid}.zip`);
		res.download(problem.additional_file.getPath(), `additional_file_${id}_${pid}.zip`);
	} catch (e) {
		zoj.log(e);
		res.status(404);
		res.render('error', {
			err: e
		});
	}
});
