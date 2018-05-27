'use strict';

let statisticsStatements = {
	fastest:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` ASC LIMIT 1 ) AS `id`, ( SELECT `total_time` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` ASC LIMIT 1 ) AS `total_time` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` ASC ',
	slowest:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` DESC LIMIT 1 ) AS `id`, ( SELECT `total_time` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` DESC LIMIT 1 ) AS `total_time` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `total_time` DESC ',
	shortest:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY LENGTH(`code`) ASC LIMIT 1 ) AS `id`, ( SELECT LENGTH(`code`) FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY LENGTH(`code`) ASC LIMIT 1 ) AS `code_length` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `code_length` ASC ',
	longest:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY LENGTH(`code`) DESC LIMIT 1 ) AS `id`, ( SELECT LENGTH(`code`) FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY LENGTH(`code`) DESC LIMIT 1 ) AS `code_length` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `code_length` DESC ',
	earliest:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `submit_time` ASC LIMIT 1 ) AS `id`, ( SELECT `submit_time` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `submit_time` ASC LIMIT 1 ) AS `submit_time` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `submit_time` ASC ',
	min:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` ASC LIMIT 1 ) AS `id`, ( SELECT `max_memory` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` ASC LIMIT 1 ) AS `max_memory` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` ASC ',
	max:
		'SELECT DISTINCT(`user_id`) AS `user_id`, ( SELECT `id` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` ASC LIMIT 1 ) AS `id`, ( SELECT `max_memory` FROM `judge_state` `inner_table` WHERE `problem_id` = `outer_table`.`problem_id` AND `user_id` = `outer_table`.`user_id` AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` ASC LIMIT 1 ) AS `max_memory` FROM `judge_state` `outer_table` WHERE `problem_id` = __PROBLEM_ID__ AND `status` = "Accepted" AND `type` = 0 ORDER BY `max_memory` DESC '
};

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');
let File = zoj.model('file');
let Group = zoj.model('group');

let model = db.define('problem',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

		title: { type: Sequelize.STRING(80) },
		user_id: {
			type: Sequelize.INTEGER,
			references: {
				model: 'user',
				key: 'id'
			}
		},
		publicizer_id: {
			type: Sequelize.INTEGER,
			references: {
				model: 'user',
				key: 'id'
			}
		},
		is_anonymous: { type: Sequelize.BOOLEAN },

		content: { type: Sequelize.TEXT },

		additional_file_id: { type: Sequelize.INTEGER },
		testdata_hash: { type: Sequelize.STRING(120) },

		ac_num: { type: Sequelize.INTEGER },
		submit_num: { type: Sequelize.INTEGER },

		groups_exlude_config: { type: Sequelize.TEXT, json: true },
		groups_include_config: { type: Sequelize.TEXT, json: true },

		datainfo: { type: Sequelize.TEXT, json: true }
	}, {
		timestamps: false,
		tableName: 'problem',
		indexes: [
			{ fields: ['title'], },
			{ fields: ['user_id'], }
		]
	}
);

let Model = require('./common');
class Problem extends Model {
	static async create(val) {
		return await Problem.fromRecord(Problem.model.build(Object.assign({
			title: '',
			user_id: '',
			publicizer_id: '',
			is_anonymous: false,
			content: '',

			ac_num: 0,
			submit_num: 0,

			datainfo: '',
			testdata_hash: '',

			groups_exlude_config: '[]',
			groups_include_config: '[]'
		}, val)));
	}

	async loadRelationships() {
		this.user = await User.fromID(this.user_id);
		this.publicizer = await User.fromID(this.publicizer_id);
		this.additional_file = await File.fromID(this.additional_file_id);
		this.groups_exlude = [];
		for (var group of this.groups_exlude_config) {
			this.groups_exlude.push(await Group.fromID(group));
		}
		this.groups_include = [];
		for (var group of this.groups_include_config) {
			this.groups_include.push(await Group.fromID(group));
		}
	}

	match(gA, gB) {
		gA.sort((a, b) => { a.id < b.id; });
		gB.sort((a, b) => { a.id < b.id; });
		let idA = 0, idB = 0;
		while (idA < gA.length && idB < gB.length) {
			if (gA[idA].id === gB[idB].id) return true;
			if (gA[idA].id < gB[idB].id) idA++;
			else idB++;
		}
		return false;
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		if (this.user_id === user.id) return true;
		return await user.haveAccess('problem_manage');
	}

	async isAllowedUseBy(user) {
		if (!user) return false;
		if (this.user_id === user.id) return true;
		if (await user.haveAccess('problem_manage')) return true;
		if (await this.match(user.groups, this.groups_exlude)) return false;
		if (await this.match(user.groups, this.groups_include)) return true;
		return false;
	}

	getTestdataPath() {
		return zoj.utils.resolvePath(zoj.config.upload_dir, 'testdata', this.id.toString());
	}

	async updateTestdataHash() {
		if (!await zoj.utils.isFile(this.getTestdataPath() + '.zip')) {
			await this.makeTestdataZip();
		}
		let fs = Promise.promisifyAll(require('fs-extra'));
		let buffer = fs.readFileSync(this.getTestdataPath() + '.zip');
		let md5 = zoj.utils.md5(buffer);
		this.testdata_hash = md5;
	}

	async ValidDataInfo() {
		if (!this.datainfo.time_limit) this.datainfo.time_limit = zoj.config.default.problem.time_limit;
		if (!this.datainfo.memory_limit) this.datainfo.memory_limit = zoj.config.default.problem.memory_limit;
		if (!this.datainfo.output_limit) this.datainfo.output_limit = zoj.config.default.problem.output_limit;
		if (!this.datainfo.judge_method) this.datainfo.judge_method = 'compare_text';
		if (!this.datainfo || !this.datainfo.testcases || !this.datainfo.testcases.length) {
			try {
				let dir = this.getTestdataPath();
				let fs = Promise.promisifyAll(require('fs-extra'));
				let path = require('path');
				let list = await (await fs.readdirAsync(dir)).filterAsync(async x => await zoj.utils.isFile(path.join(dir, x)));

				let cases = [];
				for (let file of list) {
					let parsedName = path.parse(file);
					if (parsedName.ext === '.in') {
						if (list.includes(`${parsedName.name}.out`)) {
							let o = {
								input: file,
								output: `${parsedName.name}.out`
							};
							cases.push(o);
						} else if (list.includes(`${parsedName.name}.ans`)) {
							let o = {
								input: file,
								output: `${parsedName.name}.ans`
							};
							cases.push(o);
						}
					}
				}
				cases.sort((a, b) => {
					if (a.input.length < b.input.length) return -1;
					if (a.input.length > b.input.length) return 1;
					if (a.input < b.input) return -1;
					if (a.input > b.input) return 1;
					return 0;
				});
				let subtask = Object();
				subtask.type = 'sum';
				subtask.score = 100;
				subtask.cases = cases;

				let testcases = [];
				testcases.push(subtask);
				this.datainfo.testcases = testcases;
				for (var obj of list) if (obj.startsWith('spj_')) {
					this.datainfo.spj = obj;
					break;
				}
			} catch (e) {
				zoj.error(e);
			}
		}
	}

	async updateTestdataConfigManually(config) {
		this.datainfo = config;
		await this.ValidDataInfo();
		await this.save();
	}

	async updateTestdataConfig() {
		let dir = this.getTestdataPath();
		if (!await zoj.utils.isDir(dir)) return null;
		await this.ValidDataInfo();
		await this.save();
	}

	async updateTestdata(path) {
		await zoj.utils.lock(['Problem::Testdata', this.id], async () => {
			let p7zip = new (require('node-7z'));
			let dir = this.getTestdataPath();
			let fs = Promise.promisifyAll(require('fs-extra'));
			await fs.removeAsync(dir);
			await fs.ensureDirAsync(dir);
			await p7zip.extract(path, dir);
			await fs.moveAsync(path, dir + '.zip', { overwrite: true });
		});
		await this.updateTestdataHash();
		await this.updateTestdataConfig();
	}

	async uploadTestdataSingleFile(filename, filepath) {
		await zoj.utils.lock(['Promise::Testdata', this.id], async () => {
			let dir = this.getTestdataPath();
			let fs = Promise.promisifyAll(require('fs-extra')), path = require('path');
			await fs.ensureDirAsync(dir);
			await fs.moveAsync(filepath, path.join(dir, filename), { overwrite: true });
			await fs.removeAsync(dir + '.zip');
		});
		await this.updateTestdataHash();
		await this.updateTestdataConfig();
	}

	async deleteTestdataSingleFile(filename) {
		await zoj.utils.lock(['Promise::Testdata', this.id], async () => {
			let dir = this.getTestdataPath();
			let fs = Promise.promisifyAll(require('fs-extra')), path = require('path');
			await fs.removeAsync(path.join(dir, filename));
			await fs.removeAsync(dir + '.zip');
		});
		await this.updateTestdataHash();
		await this.updateTestdataConfig();
	}

	async makeTestdataZip() {
		await zoj.utils.lock(['Promise::Testdata', this.id], async () => {
			let dir = this.getTestdataPath();
			if (await zoj.utils.isFile(dir + '.zip')) return;
			if (!await zoj.utils.isDir(dir)) throw new ErrorMessage('No testdata.');

			let p7zip = new (require('node-7z'));

			let list = await this.listTestdata(), path = require('path'), pathlist = list.files.map(file => path.join(dir, file.filename));
			if (!pathlist.length) throw new ErrorMessage('No testdata.');
			await p7zip.add(dir + '.zip', pathlist);
		});
	}

	async listTestdata() {
		try {
			let fs = Promise.promisifyAll(require('fs-extra')), path = require('path');
			let dir = this.getTestdataPath();
			let list = await fs.readdirAsync(dir);
			list = await list.mapAsync(async x => {
				let stat = await fs.statAsync(path.join(dir, x));
				if (!stat.isFile()) return undefined;
				return {
					filename: x,
					size: stat.size
				};
			});

			list = list.filter(x => x);

			let res = {
				files: list,
				zip: null
			};

			try {
				let stat = await fs.statAsync(this.getTestdataPath() + '.zip');
				if (stat.isFile()) {
					res.zip = {
						size: stat.size
					};
				}
			} catch (e) {
				if (list) {
					res.zip = {
						size: null
					};
				}
			}

			return res;
		} catch (e) {
			return null;
		}
	}

	async updateFile(path, type) {
		let file = await File.upload(path, type);

		if (type === 'additional_file') {
			this.additional_file_id = file.id;
		} else {
			throw new ErrorMessage('File update error');
		}

		await this.updateTestdataHash();
		await this.save();
		await this.updateTestdataConfig();
	}

	async getJudgeState(user, acFirst) {
		if (!user) return null;

		let JudgeState = zoj.model('judge_state');

		let where = {
			user_id: user.id,
			problem_id: this.id
		};

		if (acFirst) {
			where.status = 'Accepted';

			let state = await JudgeState.findOne({
				where: where,
				order: [['submit_time', 'desc']]
			});

			if (state) return state;
		}

		if (where.status) delete where.status;

		return await JudgeState.findOne({
			where: where,
			order: [['submit_time', 'desc']]
		});
	}

	// type: fastest / slowest / shortest / longest / earliest
	async countStatistics(type) {
		let statement = statisticsStatements[type];
		if (!statement) return null;

		statement = statement.replace('__PROBLEM_ID__', this.id);
		return await db.countQuery(statement);
	}

	// type: fastest / slowest / shortest / longest / earliest
	async getStatistics(type, paginate) {
		let statistics = {
			type: type,
			judge_state: null,
			scoreDistribution: null,
			prefixSum: null,
			suffixSum: null
		};

		let statement = statisticsStatements[type];
		if (!statement) return null;

		statement = statement.replace('__PROBLEM_ID__', this.id);

		let a;
		if (!paginate.pageCnt) a = [];
		else a = (await db.query(statement + `LIMIT ${paginate.perPage} OFFSET ${(paginate.currPage - 1) * paginate.perPage}`))[0];

		let JudgeState = zoj.model('judge_state');
		statistics.judge_state = await a.mapAsync(async x => await JudgeState.fromID(x.id));

		a = (await db.query('SELECT `score`, COUNT(*) AS `count` FROM `judge_state` WHERE `problem_id` = __PROBLEM_ID__ AND `type` = 0 AND `pending` = 0 GROUP BY `score`'.replace('__PROBLEM_ID__', this.id)))[0];

		let scoreCount = [];
		for (let score of a) {
			score.score = Math.min(Math.round(score.score), 100);
			scoreCount[score.score] = score.count;
		}
		if (scoreCount[0] === undefined) scoreCount[0] = 0;
		if (scoreCount[100] === undefined) scoreCount[100] = 0;

		statistics.scoreDistribution = [];
		for (let i = 0; i < scoreCount.length; i++) {
			if (scoreCount[i] !== undefined) statistics.scoreDistribution.push({ score: i, count: scoreCount[i] });
		}

		statistics.prefixSum = JSON.parse(JSON.stringify(statistics.scoreDistribution));
		statistics.suffixSum = JSON.parse(JSON.stringify(statistics.scoreDistribution));

		for (let i = 1; i < statistics.prefixSum.length; i++) {
			statistics.prefixSum[i].count += statistics.prefixSum[i - 1].count;
		}

		for (let i = statistics.prefixSum.length - 1; i >= 1; i--) {
			statistics.suffixSum[i - 1].count += statistics.suffixSum[i].count;
		}

		return statistics;
	}

	async getTags() {
		let ProblemTagMap = zoj.model('problem_tag_map');
		let maps = await ProblemTagMap.query(null, {
			problem_id: this.id
		});

		let ProblemTag = zoj.model('problem_tag');
		let res = await maps.mapAsync(async map => await ProblemTag.fromID(map.tag_id));

		res.sort((a, b) => {
			return a.color > b.color ? 1 : -1;
		});

		return res;
	}

	async setTags(newTagIDs) {
		let ProblemTagMap = zoj.model('problem_tag_map');

		let oldTagIDs = (await this.getTags()).map(x => x.id);

		let delTagIDs = oldTagIDs.filter(x => !newTagIDs.includes(x));
		let addTagIDs = newTagIDs.filter(x => !oldTagIDs.includes(x));

		for (let tagID of delTagIDs) {
			let map = await ProblemTagMap.findOne({
				where: {
					problem_id: this.id,
					tag_id: tagID
				}
			});

			await map.destroy();
		}

		for (let tagID of addTagIDs) {
			let map = await ProblemTagMap.create({
				problem_id: this.id,
				tag_id: tagID
			});

			await map.save();
		}
	}

	async changeID(id) {
		id = parseInt(id);
		await db.query('UPDATE `problem` SET `id` = ' + id + ' WHERE `id` = ' + this.id);
		await db.query('UPDATE `judge_state` SET `problem_id` = ' + id + ' WHERE `problem_id` = ' + this.id);
		await db.query('UPDATE `problem_tag_map` SET `problem_id` = ' + id + ' WHERE `problem_id` = ' + this.id);
		await db.query('UPDATE `article` SET `problem_id` = ' + id + ' WHERE `problem_id` = ' + this.id);

		let Contest = zoj.model('contest');
		let contests = await Contest.all();
		for (let contest of contests) {
			let problems = await contest.getProblems();

			let flag = false;
			for (let i in problems) {
				if (problems[i].id === this.id) {
					problems[i].id = id;
					flag = true;
				}
			}

			if (flag) {
				await contest.setProblemsNoCheck(problems);
				await contest.save();
			}
		}

		let oldTestdataDir = this.getTestdataPath(), oldTestdataZip = oldTestdataDir + '.zip';

		this.id = id;

		// Move testdata
		let newTestdataDir = this.getTestdataPath(), newTestdataZip = newTestdataDir + '.zip';
		let fs = Promise.promisifyAll(require('fs-extra'));
		if (await zoj.utils.isDir(oldTestdataDir)) {
			await fs.moveAsync(oldTestdataDir, newTestdataDir);
		}

		if (await zoj.utils.isFile(oldTestdataZip)) {
			await fs.moveAsync(oldTestdataZip, newTestdataZip);
		}

		await this.save();
	}

	async delete() {
		let fs = Promise.promisifyAll(require('fs-extra'));
		let oldTestdataDir = this.getTestdataPath(), oldTestdataZip = oldTestdataDir + '.zip';
		await fs.removeAsync(oldTestdataDir);
		await fs.removeAsync(oldTestdataZip);

		let JudgeState = zoj.model('judge_state');
		let submissions = await JudgeState.query(null, { problem_id: this.id }), submitCnt = {}, acUsers = new Set();
		for (let sm of submissions) {
			if (sm.status === 'Accepted') acUsers.add(sm.user_id);
			if (!submitCnt[sm.user_id]) {
				submitCnt[sm.user_id] = 1;
			} else {
				submitCnt[sm.user_id]++;
			}
		}

		for (let u in submitCnt) {
			let user = await User.fromID(u);
			user.submit_num -= submitCnt[u];
			if (acUsers.has(parseInt(u))) user.ac_num--;
			await user.save();
		}

		await db.query('DELETE FROM `problem` WHERE `id` = ' + this.id);
		await db.query('DELETE FROM `judge_state` WHERE `problem_id` = ' + this.id);
		await db.query('DELETE FROM `problem_tag_map` WHERE `problem_id` = ' + this.id);
		await db.query('DELETE FROM `article` WHERE `problem_id` = ' + this.id);
	}

	getModel() { return model; }
}

Problem.model = model;

module.exports = Problem;
