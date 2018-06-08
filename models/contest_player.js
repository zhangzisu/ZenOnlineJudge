'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');

let model = db.define('contest_player',
	{
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
		self_details: {
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
		indexes: [
			{ fields: ['contest_id'], },
			{ fields: ['user_id'], }
		]
	}
);

let Model = require('./common');
class ContestPlayer extends Model {
	static async create(val) {
		return await ContestPlayer.fromRecord(ContestPlayer.model.build(Object.assign({
			contest_id: 0,
			user_id: 0,
			score: 0,
			score_details: '{}',
			self_details: '{}',
			time_spent: 0
		}, val)));
	}

	static async findInContest(where) {
		return await ContestPlayer.findOne({
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
		let type = this.contest.type;
		let func = require(`../types/contest/${type}`).calcScore;
		let result = await func(this, judge_state);
		this.score_details = result.score_details;
		this.score = result.score;
		this.time_spent = result.time_spent;
		await this.save();
	}

	async updateSelfInfo(pid, selfscore, selftime) {
		this.self_details[pid] = {
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
