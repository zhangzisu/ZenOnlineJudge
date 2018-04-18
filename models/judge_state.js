/*
 *  Package  : models
 *  Filename : judge_state.js
 *  Create   : 2018-02-05
 */

'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');
let Problem = zoj.model('problem');
let Contest = zoj.model('contest');

let model = db.define('judge_state', {
	id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

	// The data zip's md5 if it's a submit-answer problem
	code: { type: Sequelize.TEXT('medium') },
	language: { type: Sequelize.STRING(20) },

	status: { type: Sequelize.STRING(50) },
	score: { type: Sequelize.INTEGER },
	total_time: { type: Sequelize.INTEGER },
	pending: { type: Sequelize.BOOLEAN },
	max_memory: { type: Sequelize.INTEGER },

	result: { type: Sequelize.TEXT('medium'), json: true },

	user_id: { type: Sequelize.INTEGER },
	// The id of the user who submitted
	problem_id: { type: Sequelize.INTEGER },
	// The id of the problem
	submit_time: { type: Sequelize.INTEGER },
	type: { type: Sequelize.INTEGER },
	/*
	 * "type" indicate it's contest's submission(type = 1) or normal submission(type = 0)
	 * "type_info" will be the contest id if it's a contest's submission
	 */
	type_info: { type: Sequelize.INTEGER }
}, {
		timestamps: false,
		tableName: 'judge_state',
		indexes: [
			{
				fields: ['status'],
			},
			{
				fields: ['score'],
			},
			{
				fields: ['user_id'],
			},
			{
				fields: ['problem_id'],
			}
		]
	});

let Model = require('./common');
class JudgeState extends Model {
	static async create(val) {
		return JudgeState.fromRecord(JudgeState.model.build(Object.assign({
			code: '',
			language: '',
			user_id: 0,
			problem_id: 0,
			submit_time: parseInt((new Date()).getTime() / 1000),

			type: 0,
			type_info: 0,

			pending: true,

			score: 0,
			total_time: 0,
			max_memory: 0,
			status: 'Waiting',
			result: '{ "status": "Waiting", "total_time": 0, "max_memory": 0, "score": 0, "case_num": 0, "compiler_output": "", "pending": true, "judger": "" }'
		}, val)));
	}

	async loadRelationships() {
		this.user = await User.fromID(this.user_id);
		if (this.problem_id) this.problem = await Problem.fromID(this.problem_id);
	}

	async isAllowedVisitBy(user) {
		await this.loadRelationships();

		if (user && user.id === this.problem.user_id) return true;
		// The user is the creator of the problem.
		else if (user && user.id === this.user_id) return true;
		// The user is the submitter.
		else if (this.type === 0) {
			if (!user || await user.admin < 1) return this.problem.is_public && !this.problem.is_protected;
			else if (await user.admin < 3) return this.problem.is_public;
			return true;
		}
		// Normal submission
		// 1. The problem is public and not protected
		// 2. The problem is public and the user is indoor student/student admin
		// 3. The the user is teacher/system admin
		else if (this.type === 1) {
			let contest = await Contest.fromID(this.type_info);
			if (await contest.isRunning()) {
				return ((user && user.admin >= 3) || (user && user.id === contest.holder_id));
			} else {
				return true;
			}
		}
		// Contest's submissions
		// 1. The user is teacher/system admin
		// 2. The user is the holder of the contest
		// 3. The contest is not running
	}

	async isAllowedSeeCodeBy(user) {
		await this.loadRelationships();

		if (user && user.id === this.problem.user_id) return true;
		// The user is the creator of the problem
		else if (user && user.id === this.user_id) return true;
		// The user is the submitter
		else if (this.type === 0) return this.problem.is_public || (user && (await user.admin >= 3));
		// Normal submission
		// 1. The problem is public
		// 2. The user is teacher/system admin
		else if (this.type === 1) {
			let contest = await Contest.fromID(this.type_info);
			if (await contest.isRunning()) {
				return (user && user.admin >= 3) || (user && user.id === contest.holder_id);
			} else {
				return true;
			}
		}
		// Contest's submission
		// 1. The user is the teacher/system admin
		// 2. The user is the holder of the contest
		// 3. The contest is not running
	}

	async isAllowedSeeCaseBy(user) {
		await this.loadRelationships();

		if (user && user.id === this.problem.user_id) return true;
		// The user is the creator of the problem
		else if (this.type === 0) return this.problem.is_public || (user && (await user.admin >= 3));
		// Normal Submission
		// 1. The problem is public
		// 2. The user is teacher/system admin
		else if (this.type === 1) {
			let contest = await Contest.fromID(this.type_info);
			if (await contest.isRunning()) {
				return (contest.type === 'ioi' && user && user.id === this.user_id) 
						|| (user && user.admin >= 3) || (user && user.id === contest.holder_id);
			} else {
				return true;
			}
		}
		// Contest's submission
		// 1.The user is teacher/system admin
		// 2.The contest's type is "ioi" and the user is the submitter
		// 3.The user is the holder of the contest
		// 4.The contest is not running
	}

	async isAllowedSeeDataBy(user) {
		await this.loadRelationships();

		if (user && user.id === this.problem.user_id) return true;
		// The user is the creator of the problem
		else if (this.type === 0) return this.problem.is_public || (user && (await user.admin >= 3));
		// Normal submission
		// 1. The problem is public
		// 2. The user is teacher/system admin
		else if (this.type === 1) {
			let contest = await Contest.fromID(this.type_info);
			if (await contest.isRunning()) {
				return (user && user.admin >= 3) || (user && user.id === contest.holder_id);
			} else {
				return true;
			}
		}
		// Contest's submission
		// 1. The user is teacher/system admin
		// 2. The user is the holder of the contest
	}

	async updateResult(result) {
		this.score = result.score;
		this.pending = result.pending;
		this.status = result.status;
		if (this.language) {
			// language is empty if it's a submit-answer problem
			this.total_time = result.total_time;
			this.max_memory = result.max_memory;
		}
		this.result = result;
	}

	async updateRelatedInfo(newSubmission) {
		await zoj.utils.lock(['JudgeState::updateRelatedInfo', 'problem', this.problem_id], async () => {
			await zoj.utils.lock(['JudgeState::updateRelatedInfo', 'user', this.user_id], async () => {
				if (this.type === 0) {
					if (newSubmission) {
						await this.loadRelationships();
						await this.user.refreshSubmitInfo();
						this.problem.submit_num++;
						await this.user.save();
						await this.problem.save();
						// New submission
					} else if (this.status === 'Accepted') {
						await this.loadRelationships();
						await this.user.refreshSubmitInfo();
						this.problem.ac_num++;
						await this.user.save();
						await this.problem.save();
						// New AC submission
					}
				} else if (this.type === 1) {
					let contest = await Contest.fromID(this.type_info);
					await contest.newSubmission(this);
				}
			});
		});
	}

	async rejudge() {
		await zoj.utils.lock(['JudgeState::rejudge', this.id], async () => {
			await this.loadRelationships();

			let oldStatus = this.status;

			this.status = 'Waiting';
			this.score = 0;
			if (this.language) {
				// language is empty if it's a submit-answer problem
				this.total_time = 0;
				this.max_memory = 0;
			}
			this.pending = true;
			this.result = { status: "Waiting", total_time: 0, max_memory: 0, score: 0, case_num: 0, compiler_output: "", pending: true, judger: "" };
			await this.save();

			let WaitingJudge = zoj.model('waiting_judge');
			let waiting_judge = await WaitingJudge.create({
				judge_id: this.id,
				priority: 2,
				type: 'submission'
			});

			await waiting_judge.save();

			if (oldStatus === 'Accepted') {
				await this.user.refreshSubmitInfo();
				await this.user.save();
			}

			if (this.type === 0) {
				if (oldStatus === 'Accepted') {
					this.problem.ac_num--;
					await this.problem.save();
				}
			} else if (this.type === 1) {
				let contest = await Contest.fromID(this.type_info);
				await contest.newSubmission(this);
			}
		});
	}

	async getProblemType() {
		await this.loadRelationships();
		return this.problem.type;
	}

	getModel() { return model; }
}

JudgeState.model = model;

module.exports = JudgeState;