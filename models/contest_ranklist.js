'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let ContestPlayer = zoj.model('contest_player');

let model = db.define('contest_ranklist',
	{
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		ranklist: {
			type: Sequelize.TEXT,
			json: true
		}
	}, {
		timestamps: false,
		tableName: 'contest_ranklist'
	}
);

let Model = require('./common');
class ContestRanklist extends Model {
	static async create(val) {
		return await ContestRanklist.fromRecord(ContestRanklist.model.build(Object.assign({
			ranklist: '{}'
		}, val)));
	}

	async getPlayers() {
		let a = [];
		for (let i = 1; i <= this.ranklist.player_num; i++) {
			a.push(await ContestPlayer.fromID(this.ranklist[i]));
		}
		return a;
	}

	async updatePlayer(contest, player) {
		let players = await this.getPlayers(),
			newPlayer = true;
		for (let x of players) {
			if (x.user_id === player.user_id) {
				newPlayer = false;
				break;
			}
		}

		if (newPlayer) {
			players.push(player);
		}

		let func = require(`../types/contest/${contest.type}`).updateRank;
		players = await func(players);

		this.ranklist = {
			player_num: players.length
		};
		for (let i = 0; i < players.length; i++) this.ranklist[i + 1] = players[i].id;
	}

	getModel() {
		return model;
	}
}

ContestRanklist.model = model;

module.exports = ContestRanklist;
