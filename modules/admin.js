let Problem = zoj.model('problem');
let JudgeState = zoj.model('judge_state');
let Article = zoj.model('article');
let Contest = zoj.model('contest');
let User = zoj.model('user');
let Group = zoj.model('group');
const RatingCalculation = zoj.model('rating_calculation');
const RatingHistory = zoj.model('rating_history');
const calcRating = require('../libs/rating');
let ContestPlayer = zoj.model('contest_player');
const os = require('os');

app.get('/admin/group', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_group')) throw new ErrorMessage('You do not have permission to do this.');

		let groups = await Group.query(null, null, null);

		res.render('admin_group', {
			groups: groups
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/group/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_group')) throw new ErrorMessage('You do not have permission to do this.');

		let id = parseInt(req.params.id);
		let group;

		if (id === 0) {
			group = await Group.create();
		} else {
			group = await Group.fromID(id);
			if (!group) throw new ErrorMessage('No such group.');
		}

		res.render('admin_group_edit', {
			group: group
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/group/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_group')) throw new ErrorMessage('You do not have permission to do this.');

		let id = parseInt(req.params.id), group;

		if (!id) {
			group = await Group.create();
			group.name = req.body.name;
			group.config = JSON.parse(req.body.config);
			await group.save();
		} else {
			group = await Group.fromID(id);
			if (!group) throw new ErrorMessage('No such group.');
			group.name = req.body.name;
			group.config = JSON.parse(req.body.config);
			await group.save();
		}

		res.redirect(`/admin/group/${group.id}`);
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/message', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_message')) throw new ErrorMessage('You do not have permission to do this.');

		res.render('admin_message', {
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/message', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_message')) throw new ErrorMessage('You do not have permission to do this.');
		let id = parseInt(req.body.user_id) || null;
		io.emit(req.body.type, {
			user_id: id,
			data: req.body.message
		});
		res.redirect(zoj.utils.makeUrl(['admin', 'message']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/rating', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_rating')) throw new ErrorMessage('You do not have permission to do this.');

		const contests = await Contest.query(null, {}, [['start_time', 'desc']]);
		const calcs = await RatingCalculation.query(null, {}, [['id', 'desc']]);

		for (const calc of calcs) await calc.loadRelationships();

		res.render('admin_rating', {
			contests: contests,
			calcs: calcs
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/rating/add', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_rating')) throw new ErrorMessage('You do not have permission to do this.');

		const contest = await Contest.fromID(req.body.contest);
		if (!contest) throw new ErrorMessage('No such contest');

		await contest.loadRelationships();
		const newcalc = await RatingCalculation.create(contest.id);
		await newcalc.save();

		if (!contest.ranklist || contest.ranklist.ranklist.player_num <= 1) {
			throw new ErrorMessage('Too few players.');
		}

		const players = [];
		for (let i = 1; i <= contest.ranklist.ranklist.player_num; i++) {
			const user = await User.fromID((await ContestPlayer.fromID(contest.ranklist.ranklist[i])).user_id);
			players.push({
				user: user,
				rank: i,
				currentRating: user.rating
			});
		}
		const newRating = calcRating(players);
		for (let i = 0; i < newRating.length; i++) {
			const user = newRating[i].user;
			user.rating = newRating[i].currentRating;
			await user.save();
			const newHistory = await RatingHistory.create(newcalc.id, user.id, newRating[i].currentRating, newRating[i].rank);
			await newHistory.save();
		}

		res.redirect(zoj.utils.makeUrl(['admin', 'rating']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/rating/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_rating')) throw new ErrorMessage('You do not have permission to do this.');

		const calcList = await RatingCalculation.query(null, { id: { $gte: req.body.calc_id } }, [['id', 'desc']]);
		if (calcList.length === 0) throw new ErrorMessage('ID incorrect');

		for (let i = 0; i < calcList.length; i++) {
			await calcList[i].delete();
		}

		res.redirect(zoj.utils.makeUrl(['admin', 'rating']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/info', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_info')) throw new ErrorMessage('You do not have permission to do this.');

		let allSubmissionsCount = await JudgeState.count();
		let todaySubmissionsCount = await JudgeState.count({ submit_time: { $gte: zoj.utils.getCurrentDate(true) } });
		let problemsCount = await Problem.count();
		let articlesCount = await Article.count();
		let contestsCount = await Contest.count();
		let usersCount = await User.count();

		res.render('admin_info', {
			allSubmissionsCount: allSubmissionsCount,
			todaySubmissionsCount: todaySubmissionsCount,
			problemsCount: problemsCount,
			articlesCount: articlesCount,
			contestsCount: contestsCount,
			usersCount: usersCount,
			totalMemory: Math.ceil(os.totalmem() / 1024 / 1024 / 1024),
			uptime: Math.round(os.uptime() / 60 / 60)
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});


app.get('/admin/rejudge', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_rejudge')) throw new ErrorMessage('You do not have permission to do this.');

		res.render('admin_rejudge', {
			form: {},
			count: null
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/rejudge', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_rejudge')) throw new ErrorMessage('You do not have permission to do this.');

		let user = await User.fromName(req.body.submitter || '');
		let where = {};
		if (user) where.user_id = user.id;
		else if (req.body.submitter) where.user_id = -1;

		let minID = parseInt(req.body.min_id);
		if (isNaN(minID)) minID = 0;
		let maxID = parseInt(req.body.max_id);
		if (isNaN(maxID)) maxID = 2147483647;

		where.id = {
			$and: {
				$gte: parseInt(minID),
				$lte: parseInt(maxID)
			}
		};

		let minScore = parseInt(req.body.min_score);
		if (isNaN(minScore)) minScore = 0;
		let maxScore = parseInt(req.body.max_score);
		if (isNaN(maxScore)) maxScore = 100;

		where.score = {
			$and: {
				$gte: parseInt(minScore),
				$lte: parseInt(maxScore)
			}
		};

		let minTime = zoj.utils.parseDate(req.body.min_time);
		if (isNaN(minTime)) minTime = 0;
		let maxTime = zoj.utils.parseDate(req.body.max_time);
		if (isNaN(maxTime)) maxTime = 2147483647;

		where.submit_time = {
			$and: {
				$gte: parseInt(minTime),
				$lte: parseInt(maxTime)
			}
		};

		if (req.body.language) {
			where.language = req.body.language;
		}
		if (req.body.status) where.status = { $like: req.body.status + '%' };
		if (req.body.problem_id) where.problem_id = parseInt(req.body.problem_id) || -1;

		let count = await JudgeState.count(where);
		if (req.body.type === 'rejudge') {
			let submissions = await JudgeState.query(null, where);
			for (let submission of submissions) {
				await submission.rejudge();
			}
		}

		res.render('admin_rejudge', {
			form: req.body,
			count: count
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/links', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_link')) throw new ErrorMessage('You do not have permission to do this.');

		res.render('admin_links', {
			links: zoj.config.links || []
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/links', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_link')) throw new ErrorMessage('You do not have permission to do this.');

		zoj.config.links = JSON.parse(req.body.data);
		await zoj.utils.saveConfig();

		res.redirect(zoj.utils.makeUrl(['admin', 'links']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/raw', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_raw')) throw new ErrorMessage('You do not have permission to do this.');

		res.render('admin_raw', {
			data: JSON.stringify(zoj.config, null, 2)
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/raw', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_raw')) throw new ErrorMessage('You do not have permission to do this.');

		zoj.config = JSON.parse(req.body.data);
		await zoj.utils.saveConfig();

		res.redirect(zoj.utils.makeUrl(['admin', 'raw']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/admin/upgrade', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_upgrade')) throw new ErrorMessage('You do not have permission to do this.');

		res.render('admin_upgrade', {});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/admin/upgrade', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		if (!await res.locals.user.haveAccess('admin_upgrade')) throw new ErrorMessage('You do not have permission to do this.');

		var exec = require('child_process').exec;
		exec('sh upgrade.sh', function (error) {
			if (error !== null) {
				zoj.log('exec error: ' + error);
			}
		});

		res.redirect('/');
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});