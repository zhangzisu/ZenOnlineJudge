/*
 *  Package  : models
 *  Filename : contest.js
 *  Create   : 2018-02-05
 * 
 *  Introduce to Privilege System:
 *    Privileges:
 *      0 : Common user
 *          No permission to access protected problems
 *          No permission to access protected contests
 *          No administration access
 *      1 : Indoor user
 *          Have permission to access protected problems
 *          Have permission to access protected contests
 *          No administration access
 *      2 : Student administrators
 *          Have permission to edit problems
 *          Have permission to edit articles
 *          No other administration access
 *      3 : Teacher administrators
 *          Have permission to edit contests and peoples
 *          Cannot access system core
 *      4 : Super administrator (ME) 
 *          I can do anything I want,
 *            edit anything I dislike,
 *            and access mysql.
 */

'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let model = db.define('user', {
	id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
	username: { type: Sequelize.STRING(80), unique: true },
	email: { type: Sequelize.STRING(120) },
	password: { type: Sequelize.STRING(120) },
	nickname: { type: Sequelize.STRING(80) },
	information: { type: Sequelize.TEXT },
	ac_num: { type: Sequelize.INTEGER },
	submit_num: { type: Sequelize.INTEGER },
	admin: { type: Sequelize.INTEGER },
	is_show: { type: Sequelize.BOOLEAN },
	// is_show : Whether the user is banned
	public_email: { type: Sequelize.BOOLEAN },
	sex: { type: Sequelize.INTEGER },
	rating: { type: Sequelize.INTEGER },
	theme: { type: Sequelize.STRING(10) }
}, {
		timestamps: false,
		tableName: 'user',
		indexes: [
			{
				fields: ['username'],
				unique: true
			},
			{
				fields: ['nickname'],
			},
			{
				fields: ['ac_num'],
			}
		]
	});

let Model = require('./common');
class User extends Model {
	static async create(val) {
		return User.fromRecord(User.model.build(Object.assign({
			username: '',
			password: '',
			email: '',
			nickname: '',
			admin: 0,
			ac_num: 0,
			submit_num: 0,
			sex: 0,
			is_show: zoj.config.default.user.show,
			rating: zoj.config.default.user.rating,
			theme: "light"
		}, val)));
	}

	static async fromName(name) {
		return User.fromRecord(User.model.findOne({
			where: {
				username: name
			}
		}));
	}

	static async fromEmail(email) {
		return User.fromRecord(User.model.findOne({
			where: {
				email: email
			}
		}));
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		if (this.id === user.id) return true;
		return user.admin >= 3 && user.admin > this.admin;
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
			"Accepted": ["Accepted"],
			"Wrong Answer": ["Wrong Answer", "File Error", "Output Limit Exceeded"],
			"Runtime Error": ["Runtime Error"],
			"Time Limit Exceeded": ["Time Limit Exceeded"],
			"Memory Limit Exceeded": ["Memory Limit Exceeded"],
			"Compile Error": ["Compile Error"]
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
