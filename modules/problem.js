'use strict';

let Problem = zoj.model('problem');
let Group = zoj.model('group');
let JudgeState = zoj.model('judge_state');
let WaitingJudge = zoj.model('waiting_judge');
let Contest = zoj.model('contest');
let ProblemTag = zoj.model('problem_tag');
let ProblemTagMap = zoj.model('problem_tag_map');
let Article = zoj.model('article');

app.get('/problems', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let paginate = zoj.utils.paginate(await Problem.count({}), req.query.page, zoj.config.page.problem);
		let problems = await Problem.query(paginate, {});
		await res.locals.user.loadRelationships();

		let tmp = [];
		for (var p of problems) {
			await p.loadRelationships();
			if (await p.isAllowedUseBy(res.locals.user)) tmp.push(p);
		}
		problems = tmp;

		await problems.forEachAsync(async problem => {
			problem.allowedEdit = await problem.isAllowedEditBy(res.locals.user);
			problem.judge_state = await problem.getJudgeState(res.locals.user, true);
			problem.tags = await problem.getTags();
		});

		res.render('problems', {
			allowedManageTag: res.locals.user.haveAccess('manage_tag'),
			problems: problems,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problems/search', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		await res.locals.user.loadRelationships();

		let id = parseInt(req.query.keyword) || 0;

		let where = {
			$or: {
				title: { like: `%${req.query.keyword}%` },
				id: id
			}
		};

		let order = [zoj.db.literal('`id` = ' + id + ' DESC'), ['id', 'ASC']];

		let paginate = zoj.utils.paginate(await Problem.count(where), req.query.page, zoj.config.page.problem);
		let problems = await Problem.query(paginate, where, order);

		let tmp = [];
		for (var p of problems) {
			await p.loadRelationships();
			if (await p.isAllowedUseBy(res.locals.user)) tmp.push(p);
		}
		problems = tmp;

		await problems.forEachAsync(async problem => {
			problem.allowedEdit = await problem.isAllowedEditBy(res.locals.user);
			problem.judge_state = await problem.getJudgeState(res.locals.user, true);
			problem.tags = await problem.getTags();
		});

		res.render('problems', {
			allowedManageTag: res.locals.user.haveAccess('manage_tag'),
			problems: problems,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problems/tag/:tagIDs', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		await res.locals.user.loadRelationships();

		let tagIDs = Array.from(new Set(req.params.tagIDs.split(',').map(x => parseInt(x))));
		let tags = await tagIDs.mapAsync(async tagID => ProblemTag.fromID(tagID));

		// Validate the tagIDs
		for (let tag of tags) {
			if (!tag) {
				return res.redirect(zoj.utils.makeUrl(['problems']));
			}
		}

		let sql = 'SELECT * FROM `problem` WHERE\n';
		for (let tagID of tagIDs) {
			if (tagID !== tagIDs[0]) {
				sql += 'AND\n';
			}

			sql += '`problem`.`id` IN (SELECT `problem_id` FROM `problem_tag_map` WHERE `tag_id` = ' + tagID + ')';
		}

		let paginate = zoj.utils.paginate(await Problem.count(sql), req.query.page, zoj.config.page.problem);
		let problems = await Problem.query(sql + paginate.toSQL());

		let tmp = [];
		for (var p of problems) {
			await p.loadRelationships();
			if (await p.isAllowedUseBy(res.locals.user)) tmp.push(p);
		}
		problems = tmp;

		await problems.forEachAsync(async problem => {
			problem.allowedEdit = await problem.isAllowedEditBy(res.locals.user);
			problem.judge_state = await problem.getJudgeState(res.locals.user, true);
			problem.tags = await problem.getTags();
		});

		res.render('problems', {
			allowedManageTag: res.locals.user.haveAccess('manage_tag'),
			problems: problems,
			tags: tags,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);
		if (!problem) throw new ErrorMessage('No such problem.');

		await problem.loadRelationships();

		if (!await problem.isAllowedUseBy(res.locals.user)) {
			throw new ErrorMessage('You do not have permission to do this.');
		}

		problem.allowedEdit = await problem.isAllowedEditBy(res.locals.user);
		problem.allowedManage = await problem.isAllowedEditBy(res.locals.user);
		problem.content = await zoj.utils.markdown(problem.content);

		let state = await problem.getJudgeState(res.locals.user, false);
		problem.tags = await problem.getTags();
		let discussionCount = await Article.count({ problem_id: id });

		res.render('problem', {
			problem: problem,
			state: state,
			lastLanguage: res.locals.user ? await res.locals.user.getLastSubmitLanguage() : null,
			discussionCount: discussionCount
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/export/:token?', async (req, res) => {
	try {
		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);
		let token = req.params.token || '';
		if (!problem) throw new ErrorMessage('No such problem.');
		if (token !== zoj.config.token) throw new ErrorMessage('You do not have permission to do this.');

		let obj = {
			title: problem.title,
			content: problem.content,
			datainfo: problem.datainfo,
			tags: []
		};

		let tags = await problem.getTags();

		obj.tags = tags.map(tag => tag.name);

		res.send({ success: true, obj: obj });
	} catch (e) {
		zoj.log(e);
		res.send({ success: false, error: e });
	}
});

app.get('/problem/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id) || 0;
		let problem = await Problem.fromID(id);

		if (!problem) {
			problem = await Problem.create();
			problem.id = id;
			problem.allowedEdit = true;
			problem.tags = [];
			problem.new = true;
			await problem.loadRelationships();
		} else {
			await problem.loadRelationships();
			if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
			problem.allowedEdit = true;
			problem.tags = await problem.getTags();
		}

		problem.allowedManage = await problem.isAllowedEditBy(res.locals.user);

		res.render('problem_edit', {
			problem: problem
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id) || 0;
		let problem = await Problem.fromID(id);
		await res.locals.user.loadRelationships();

		if (!problem) {
			problem = await Problem.create();

			if (await res.locals.user.haveAccess('problem_id')) {
				let customID = parseInt(req.body.id);
				if (customID) {
					if (await Problem.fromID(customID)) throw new ErrorMessage('ID is used.');
					problem.id = customID;
				} else if (id) problem.id = id;
			}

			problem.user_id = res.locals.user.id;
			problem.publicizer_id = res.locals.user.id;
		} else {
			if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

			if (await res.locals.user.haveAccess('problem_id')) {
				let customID = parseInt(req.body.id);
				if (customID && customID !== id) {
					if (await Problem.fromID(customID)) throw new ErrorMessage('ID is used.');
					await problem.changeID(customID);
				}
			}
		}

		if (!req.body.title.trim()) throw new ErrorMessage('Title cannot be empty.');
		problem.title = req.body.title;
		problem.content = req.body.content;
		problem.is_anonymous = (req.body.is_anonymous === 'on');

		// Save the problem first, to have the `id` allocated
		await problem.save();

		if (!req.body.tags) {
			req.body.tags = [];
		} else if (!Array.isArray(req.body.tags)) {
			req.body.tags = [req.body.tags];
		}

		let newTagIDs = await req.body.tags.map(x => parseInt(x)).filterAsync(async x => ProblemTag.fromID(x));
		await problem.setTags(newTagIDs);

		if (await res.locals.user.haveAccess('problem_edit')) {
			if (req.body.groups_exlude) {
				if (!Array.isArray(req.body.groups_exlude)) req.body.groups_exlude = [req.body.groups_exlude];
				let groups = await req.body.groups_exlude.map(x => parseInt(x)).filterAsync(async x => Group.fromID(x));
				problem.groups_exlude_config = groups;
			}

			if (req.body.groups_include) {
				if (!Array.isArray(req.body.groups_include)) req.body.groups_include = [req.body.groups_include];
				let groups = await req.body.groups_include.map(x => parseInt(x)).filterAsync(async x => Group.fromID(x));
				problem.groups_include_config = groups;
			}
		}

		await problem.save();

		res.redirect(zoj.utils.makeUrl(['problem', problem.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/import', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id) || 0;
		let problem = await Problem.fromID(id);

		if (!problem) {
			problem = await Problem.create();
			problem.id = id;
			problem.new = true;
			problem.user_id = res.locals.user.id;
			problem.publicizer_id = res.locals.user.id;
		} else {
			await problem.loadRelationships();
			if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
		}

		problem.allowedManage = await problem.isAllowedEditBy(res.locals.user);

		res.render('problem_import', {
			problem: problem
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/import', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id) || 0;
		let problem = await Problem.fromID(id);
		if (!problem) {
			problem = await Problem.create();

			let customID = parseInt(req.body.id);
			if (customID) {
				if (await Problem.fromID(customID)) throw new ErrorMessage('ID is used.');
				problem.id = customID;
			} else if (id) problem.id = id;

			problem.user_id = res.locals.user.id;
			problem.publicizer_id = res.locals.user.id;
		} else {
			await problem.loadRelationships();
			if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
		}

		let request = require('request-promise');
		let url = require('url');
		let token = req.body.token || '';

		if (req.body.type === 'SYZOJ') {
			let json = await request({
				rejectUnauthorized: false,
				uri: req.body.url + (req.body.url.endsWith('/') ? 'export' : '/export'),
				timeout: 5000,
				json: true
			});

			if (!json.success) throw new ErrorMessage('Import failed.', null, json.error);

			if (!json.obj.title.trim()) throw new ErrorMessage('Title cannot be empty.');
			problem.title = json.obj.title;
			// SYZOJ's problem format is toxic
			problem.content = `# Description\n\n${json.obj.description}\n\n# Input Format\n\n${json.obj.input_format}\n\n# Output Format\n\n${json.obj.output_format}\n\n# Example\n\n${json.obj.example}\n\n# Limit and hint\n\n${json.obj.limit_and_hint}\n\n`;
			// No datainfo, let zoj automatic generate it.
			await problem.save();

			let tagIDs = (await json.obj.tags.mapAsync(name => ProblemTag.findOne({ where: { name: name } }))).filter(x => x).map(tag => tag.id);
			await problem.setTags(tagIDs);

			let download = require('download');
			let tmp = require('tmp-promise');
			let tmpFile = await tmp.file();
			let fs = require('bluebird').promisifyAll(require('fs'));

			try {
				let data = await download(req.body.url + (req.body.url.endsWith('/') ? 'testdata/download' : '/testdata/download'));
				await fs.writeFileAsync(tmpFile.path, data);
				await problem.updateTestdata(tmpFile.path);
			} catch (e) {
				zoj.log(e);
			}
		} else if (req.body.type === 'ZOJ') {
			let json = await request({
				rejectUnauthorized: false,
				uri: req.body.url + (req.body.url.endsWith('/') ? 'export' : '/export') + '/' + token,
				timeout: 5000,
				json: true
			});

			if (!json.success) throw new ErrorMessage('Import failed.', null, json.error);

			if (!json.obj.title.trim()) throw new ErrorMessage('Title cannot be empty.');
			problem.title = json.obj.title;
			problem.content = json.obj.content;
			problem.datainfo = json.obj.datainfo;

			await problem.save();

			let tagIDs = (await json.obj.tags.mapAsync(name => ProblemTag.findOne({ where: { name: name } }))).filter(x => x).map(tag => tag.id);
			await problem.setTags(tagIDs);

			let download = require('download');
			let tmp = require('tmp-promise');
			let tmpFile = await tmp.file();
			let fs = require('bluebird').promisifyAll(require('fs'));

			try {
				let data = await download(req.body.url + (req.body.url.endsWith('/') ? 'testdata/export/' : '/testdata/export/') + token);
				await fs.writeFileAsync(tmpFile.path, data);
				await problem.updateTestdata(tmpFile.path);
				await problem.updateTestdataConfigManually(json.obj.datainfo);
			} catch (e) {
				zoj.log(e);
			}
		} else {
			throw new ErrorMessage(`Do not support ${req.body.type}.`);
		}

		res.redirect(zoj.utils.makeUrl(['problem', problem.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/manage', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		res.render('problem_manage', {
			problem: problem
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/manage', app.multer.fields([{ name: 'testdata', maxCount: 1 }, { name: 'additional_file', maxCount: 1 }]), async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();

		if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		await problem.updateTestdataConfigManually(JSON.parse(req.body.datainfo));

		if (req.files['testdata']) {
			await problem.updateTestdata(req.files['testdata'][0].path);
		}

		if (req.files['additional_file']) {
			await problem.updateFile(req.files['additional_file'][0].path, 'additional_file');
		}

		await problem.save();

		res.redirect(zoj.utils.makeUrl(['problem', id, 'manage']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/submit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		if (!zoj.config.languages[req.body.language]) throw new ErrorMessage('Permission denied.');
		if (!res.locals.user) throw new ErrorMessage('Please login.', { 'login': zoj.utils.makeUrl(['login'], { 'url': zoj.utils.makeUrl(['problem', id]) }) });

		let judge_state;

		let code;
		if (req.body.code.length > zoj.config.limit.submit_code) throw new ErrorMessage('Your code is too long.');
		code = req.body.code;

		judge_state = await JudgeState.create({
			code: code,
			language: req.body.language,
			user_id: res.locals.user.id,
			problem_id: req.params.id
		});

		await problem.loadRelationships();

		let contest_id = parseInt(req.query.contest_id), redirectToContest = false;
		if (contest_id) {
			let contest = await Contest.fromID(contest_id);
			if (!contest) throw new ErrorMessage('No such contest.');
			if (!await contest.isRunning()) throw new ErrorMessage('Permission denied.');
			let problems_id = await contest.getProblems();
			problems_id = await problems_id.mapAsync(x => (x.id));
			if (!problems_id.includes(id)) throw new ErrorMessage('No such problem.');

			judge_state.type = 1;
			judge_state.type_info = contest_id;

			await judge_state.save();
		} else {
			if (!await problem.isAllowedUseBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
			judge_state.type = 0;
			await judge_state.save();
		}
		await judge_state.updateRelatedInfo(true);

		let waiting_judge = await WaitingJudge.create({
			judge_id: judge_state.id,
			priority: 1
		});

		await waiting_judge.save();

		res.redirect(zoj.utils.makeUrl(['submission', judge_state.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);
		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		await problem.delete();

		res.redirect(zoj.utils.makeUrl(['problem']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/testdata', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedUseBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		let testdata = await problem.listTestdata();

		problem.allowedEdit = await problem.isAllowedEditBy(res.locals.user)

		res.render('problem_data', {
			problem: problem,
			testdata: testdata
		});
	} catch (e) {
		zoj.log(e);
		res.status(404);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/testdata/upload', app.multer.array('file'), async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		if (req.files) {
			for (let file of req.files) {
				await problem.uploadTestdataSingleFile(file.originalname, file.path, file.size);
			}
		}

		res.redirect(zoj.utils.makeUrl(['problem', id, 'testdata']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/problem/:id/testdata/delete/:filename', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		await problem.deleteTestdataSingleFile(req.params.filename);

		res.redirect(zoj.utils.makeUrl(['problem', id, 'testdata']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/testdata/download/:filename?', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedUseBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		if (!req.params.filename) {
			if (!await zoj.utils.isFile(problem.getTestdataPath() + '.zip')) {
				await problem.makeTestdataZip();
			}
		}

		let path = require('path');
		let filename = req.params.filename ? path.join(problem.getTestdataPath(), req.params.filename) : (problem.getTestdataPath() + '.zip');
		if (!await zoj.utils.isFile(filename)) throw new ErrorMessage('No such file.');
		res.download(filename, path.basename(filename));
	} catch (e) {
		zoj.log(e);
		res.status(404);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/testdata/export/:token', async (req, res) => {
	try {
		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);
		let token = req.params.token || '';

		if (!problem) throw new ErrorMessage('No such problem.');
		if (token !== zoj.config.token) throw new ErrorMessage('You do not have permission to do this.');

		if (!await zoj.utils.isFile(problem.getTestdataPath() + '.zip')) {
			await problem.makeTestdataZip();
		}

		let path = require('path');
		let filename = problem.getTestdataPath() + '.zip';
		if (!await zoj.utils.isFile(filename)) throw new ErrorMessage('No such file.');
		res.download(filename, path.basename(filename));
	} catch (e) {
		zoj.log(e);
		res.status(404);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/download/additional_file', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');

		let contest_id = parseInt(req.query.contest_id);

		await problem.loadRelationships();
		if (contest_id) {
			let contest = await Contest.fromID(contest_id);
			if (!contest) throw new ErrorMessage('No such contest.');
			if (!await contest.isRunning()) throw new ErrorMessage('Permission denied.');
			let problems_id = await contest.getProblems();
			problems_id = await problems_id.mapAsync(x => (x.id));
			if (!problems_id.includes(id)) throw new ErrorMessage('No such problem.');
		} else {
			if (!await problem.isAllowedUseBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
		}

		if (!problem.additional_file) throw new ErrorMessage('No such file.');

		res.download(problem.additional_file.getPath(), `additional_file_${id}.zip`);
	} catch (e) {
		zoj.log(e);
		res.status(404);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:id/statistics/:type', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let problem = await Problem.fromID(id);

		if (!problem) throw new ErrorMessage('No such problem.');
		await problem.loadRelationships();
		await res.locals.user.loadRelationships();
		if (!await problem.isAllowedUseBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		let count = await problem.countStatistics(req.params.type);
		if (count === null) throw new ErrorMessage('No results.');

		let paginate = zoj.utils.paginate(count, req.query.page, zoj.config.page.problem_statistics);
		let statistics = await problem.getStatistics(req.params.type, paginate);
		for (let judge of statistics.judge_state) {
			judge.allowedSeeCode = judge.isAllowedSeeCodeBy(res.locals.user);
		}

		await statistics.judge_state.forEachAsync(async x => x.loadRelationships());

		res.render('statistics', {
			statistics: statistics,
			paginate: paginate,
			problem: problem
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});