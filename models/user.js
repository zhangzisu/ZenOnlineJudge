'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let model = db.define('user',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		username: { type: Sequelize.STRING(80), unique: true },
		email: { type: Sequelize.STRING(120) },
		password: { type: Sequelize.STRING(120) },
		nickname: { type: Sequelize.STRING(80) },
		information: { type: Sequelize.TEXT },
		ac_num: { type: Sequelize.INTEGER },
		submit_num: { type: Sequelize.INTEGER },
		public_email: { type: Sequelize.BOOLEAN },
		sex: { type: Sequelize.INTEGER },
		rating: { type: Sequelize.INTEGER },
		theme: { type: Sequelize.STRING(10) },
		group_config: { type: Sequelize.TEXT, json: true }
	}, {
		timestamps: false,
		tableName: 'user',
		indexes: [
			{ fields: ['username'], unique: true },
			{ fields: ['nickname'], },
			{ fields: ['ac_num'], }
		]
	}
);

let Model = require('./common');
let Group = zoj.model('group');
let Problem = zoj.model('problem');

class User extends Model {
	static async create(val) {
		return await User.fromRecord(User.model.build(Object.assign({
			username: '',
			password: '',
			email: '',
			nickname: '',
			ac_num: 0,
			submit_num: 0,
			sex: 0,
			rating: zoj.config.default.user.rating,
			theme: 'light',
			group_config: '[2]'
		}, val)));
	}

	static async fromName(name) {
		return await User.fromRecord(User.model.findOne({
			where: {
				username: name
			}
		}));
	}

	static async fromEmail(email) {
		return await User.fromRecord(User.model.findOne({
			where: {
				email: email
			}
		}));
	}

	async loadRelationships() {
		this.groups = [];
		for (var group of this.group_config) {
			this.groups.push(await Group.fromID(group));
		}
	}

	async haveAccess(name) {
		if (this.id === 1) return true;
		if (!this.groups) await this.loadRelationships();
		for (var group of this.groups) {
			if (await group.getAccess(name)) return true;
		}
		return false;
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		if (this.id === user.id) return true;
		return await user.haveAccess('user_edit');
	}

	async isAllowedDeleteBy(user) {
		if (!user) return false;
		if (this.id === user.id) return false;
		return await user.haveAccess('user_delete');
	}

	async refreshSubmitInfo() {
		await zoj.utils.lock(['User::refreshSubmitInfo', this.id], async () => {
			let JudgeState = zoj.model('judge_state');
			let all = await JudgeState.model.findAll({
				attributes: ['problem_id'],
				where: {
					user_id: this.id,
					status: 'Accepted',
					type: {
						$ne: 1 // Not a contest submission
					}
				}
			});

			let s = new Set();
			all.forEach(x => s.add(parseInt(x.get('problem_id'))));
			this.ac_num = s.size;

			let cnt = await JudgeState.count({
				user_id: this.id,
				type: {
					$ne: 1 // Not a contest submission
				}
			});

			this.submit_num = cnt;
		});
	}

	async getACProblems() {
		let JudgeState = zoj.model('judge_state');

		let all = await JudgeState.model.findAll({
			attributes: ['problem_id'],
			where: {
				user_id: this.id,
				status: 'Accepted',
				type: {
					$ne: 1 // Not a contest submission
				}
			}
		});

		let s = new Set();
		all.forEach(x => s.add(parseInt(x.get('problem_id'))));
		return Array.from(s).sort((a, b) => a - b);
	}

	async getArticles() {
		let Article = zoj.model('article');

		let all = await Article.model.findAll({
			attributes: ['id', 'title', 'public_time'],
			where: {
				user_id: this.id
			}
		});

		return all.map(x => ({
			id: x.get('id'),
			title: x.get('title'),
			public_time: x.get('public_time')
		}));
	}

	async getStatistics() {
		let JudgeState = zoj.model('judge_state');

		let statuses = {
			'Accepted': ['Accepted'],
			'Wrong Answer': ['Wrong Answer', 'File Error', 'Output Limit Exceeded'],
			'Runtime Error': ['Runtime Error'],
			'Time Limit Exceeded': ['Time Limit Exceeded'],
			'Memory Limit Exceeded': ['Memory Limit Exceeded'],
			'Compile Error': ['Compile Error']
		};

		let res = {};
		for (let status in statuses) {
			res[status] = 0;
			for (let s of statuses[status]) {
				res[status] += await JudgeState.count({
					user_id: this.id,
					type: 0,
					status: s
				});
			}
		}

		return res;
	}

	async delete() {
		let judgeState = zoj.model('judge_state');
		let Problem = zoj.model('problem');
		let Contest = zoj.model('contest');

		let submissions = await judgeState.query(null, { user_id: this.id }), submitCnt = {}, acProblems = new Set();

		for (let sm of submissions) {
			if (sm.status == "Accepted") acProblems.add(sm.problem_id);
			if (!submitCnt[sm.problem_id]) {
				submitCnt[sm.problem_id] = 1;
			} else {
				submitCnt[sm.problem_id]++;
			}
		}

		for (let u in submitCnt) {
			let problem = await Problem.fromID(u);
			problem.submit_num -= submitCnt[u];
			if (acProblems.has(parseInt(u))) problem.ac_num--; 
			await problem.save();
		}

		let problems = await Problem.query(null, { user_id: this.id });

		for (let p of problems) {
			let problem = await Problem.fromID(p.id);
			problem.user_id = 1;
			await problem.save();
		}

		let contests = await Contest.query(null, { holder_id: this.id });

		for (let p of contests) {
			let contest = await Contest.fromID(p.id);
			contest.holder_id = 1;
			await contest.save();
		}

		await db.query('DELETE FROM `user` WHERE `id` = ' + this.id);
		await db.query('DELETE FROM `comment` WHERE `user_id` = ' + this.id);
		await db.query('DELETE FROM `comment` WHERE `article_id` IN (SELECT `id` FROM `article` WHERE `user_id` = ' + this.id + ');');
		await db.query('DELETE FROM `blog_post` WHERE `user_id` = ' + this.id);
		await db.query('DELETE FROM `article` WHERE `user_id` = ' + this.id);
		await db.query('DELETE FROM `contest_player` WHERE `user_id` = ' + this.id);
		await db.query('DELETE FROM `waiting_judge` WHERE `judge_id` IN (SELECT `id` FROM `judge_state` WHERE `user_id` = ' + this.id + ');');
		await db.query('DELETE FROM `judge_state` WHERE `user_id` = ' + this.id);
	}

	async getLastSubmitLanguage() {
		let JudgeState = zoj.model('judge_state');

		let a = await JudgeState.query([1, 1], { user_id: this.id }, [['submit_time', 'desc']]);
		if (a[0]) return a[0].language;

		return null;
	}

	getModel() { return model; }
}

User.model = model;
module.exports = User;
