'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');
let Problem = zoj.model('problem');

let model = db.define('contest_player', {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	contest_id: {
		type: Sequelize.INTEGER
	},
	user_id: {
		type: Sequelize.INTEGER
	},

	score: {
		type: Sequelize.INTEGER
	},
	// Sum score
	score_details: {
		type: Sequelize.TEXT,
		json: true
	},
	// Score of every problem
	time_spent: {
		type: Sequelize.INTEGER
	}
	// Total time
}, {
	timestamps: false,
	tableName: 'contest_player',
	indexes: [{
			fields: ['contest_id'],
		},
		{
			fields: ['user_id'],
		}
	]
});

let Model = require('./common');
class ContestPlayer extends Model {
	static async create(val) {
		return ContestPlayer.fromRecord(ContestPlayer.model.build(Object.assign({
			contest_id: 0,
			user_id: 0,
			score: 0,
			score_details: '{}',
			time_spent: 0
		}, val)));
	}

	static async findInContest(where) {
		return ContestPlayer.findOne({
			where: where
		});
	}

	async loadRelationships() {
		let Contest = zoj.model('contest');
		this.user = await User.fromID(this.user_id);
		this.contest = await Contest.fromID(this.contest_id);
	}

	async updateScore(judge_state) {
		await this.loadRelationships();
		if (this.contest.type === 'ioi') {
			if (!judge_state.pending) {
				if (!this.score_details[judge_state.problem_id]) {
					this.score_details[judge_state.problem_id] = {
						score: judge_state.score,
						// Score of this problem
						judge_id: judge_state.id,
						submissions: {}
					};
				}

				this.score_details[judge_state.problem_id].submissions[judge_state.id] = {
					judge_id: judge_state.id,
					score: judge_state.score,
					time: judge_state.submit_time
					// Running time of the judge
				};

				let arr = Object.values(this.score_details[judge_state.problem_id].submissions);
				arr.sort((a, b) => a.time - b.time);

				let maxScoreSubmission = null;
				for (let x of arr) {
					if (!maxScoreSubmission || x.score >= maxScoreSubmission.score && maxScoreSubmission.score < 100) {
						maxScoreSubmission = x;
					}
				}
				// Let the score of this problem be the MAX score of all submissions
				this.score_details[judge_state.problem_id].judge_id = maxScoreSubmission.judge_id;
				this.score_details[judge_state.problem_id].score = maxScoreSubmission.score;
				this.score_details[judge_state.problem_id].time = maxScoreSubmission.time;

				await this.refreshScore(true);
			}
		} else if (this.contest.type === 'noi') {
			// Current submittion is later than the recorded one.
			if (this.score_details[judge_state.problem_id] && this.score_details[judge_state.problem_id].judge_id > judge_state.id) return;

			this.score_details[judge_state.problem_id] = {
				score: judge_state.score,
				// Score of this problem
				judge_id: judge_state.id
			};

			await this.refreshScore(true);
		} else if (this.contest.type === 'acm') {
			if (!judge_state.pending) {
				if (!this.score_details[judge_state.problem_id]) {
					this.score_details[judge_state.problem_id] = {
						accepted: false,
						unacceptedCount: 0,
						// The number of unaccepted times of this problem
						acceptedTime: 0,
						// The time from the contest began to the user accepted this problem
						judge_id: 0,
						submissions: {}
					};
				}

				this.score_details[judge_state.problem_id].submissions[judge_state.id] = {
					judge_id: judge_state.id,
					accepted: judge_state.status === 'Accepted',
					compiled: judge_state.status !== 'Compile Error',
					time: judge_state.submit_time
					// The time from the the contest began to the user submitted
				};

				let arr = Object.values(this.score_details[judge_state.problem_id].submissions);
				arr.sort((a, b) => a.time - b.time);

				this.score_details[judge_state.problem_id].unacceptedCount = 0;
				this.score_details[judge_state.problem_id].judge_id = 0;
				this.score_details[judge_state.problem_id].accepted = 0;
				for (let x of arr) {
					if (x.accepted) {
						this.score_details[judge_state.problem_id].accepted = true;
						this.score_details[judge_state.problem_id].acceptedTime = x.time;
						this.score_details[judge_state.problem_id].judge_id = x.judge_id;
						break;
					} else if (x.compiled) {
						this.score_details[judge_state.problem_id].unacceptedCount++;
					}
				}

				if (!this.score_details[judge_state.problem_id].accepted) {
					this.score_details[judge_state.problem_id].judge_id = arr[arr.length - 1].judge_id;
				}

				await this.refreshScore(true);
			}
		}
	}

	async refreshScore(loaded) {
		if (!loaded) await this.loadRelationships();
		this.score = 0;
		for (let x of this.contest.problems) {
			if (!this.score_details[x.id]) continue;
			this.score += Math.round(this.score_details[x.id].score / 100 * x.score);
		}
		await this.save();
	}

	async updateSelfInfo(pid, selfscore, selftime) {
		if (!this.score_details[pid]) this.score_details[pid] = new Object();
		this.score_details[pid].self = {
			score: selfscore,
			time: selftime
		};
	}

	getModel() {
		return model;
	}
}

ContestPlayer.model = model;

module.exports = ContestPlayer;
