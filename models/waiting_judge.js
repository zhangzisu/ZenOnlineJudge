'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let JudgeState = zoj.model('judge_state');

let model = db.define('waiting_judge',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		judge_id: { type: Sequelize.INTEGER },
		priority: { type: Sequelize.INTEGER },
	}, {
		timestamps: false,
		tableName: 'waiting_judge',
		indexes: [
			{ fields: ['judge_id'], }
		]
	}
);

let Model = require('./common');
class WaitingJudge extends Model {
	static async create(val) {
		return await WaitingJudge.fromRecord(WaitingJudge.model.build(Object.assign({
			judge_id: 0,
			priority: 0
		}, val)));
	}

	async getJudgeState() {
		return await JudgeState.fromID(this.judge_id);
	}

	getModel() { return model; }
}

WaitingJudge.model = model;

module.exports = WaitingJudge;
