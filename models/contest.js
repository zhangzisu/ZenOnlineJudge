'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');
let Group = zoj.model('group');
let ContestRanklist = zoj.model('contest_ranklist');
let ContestPlayer = zoj.model('contest_player');

let model = db.define('contest',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		title: { type: Sequelize.STRING(80) },
		subtitle: { type: Sequelize.TEXT },
		start_time: { type: Sequelize.INTEGER },
		end_time: { type: Sequelize.INTEGER },

		holder_id: {
			type: Sequelize.INTEGER,
			references: {
				model: 'user',
				key: 'id'
			}
		},
		// type: noi, ioi, acm
		type: { type: Sequelize.TEXT },

		information: { type: Sequelize.TEXT },
		problems: { type: Sequelize.TEXT, json: true },
		groups_exlude_config: { type: Sequelize.TEXT, json: true },
		groups_include_config: { type: Sequelize.TEXT, json: true },
		ranklist_id: {
			type: Sequelize.INTEGER,
			references: {
				model: 'contest_ranklist',
				key: 'id'
			}
		},

	}, {
		timestamps: false,
		tableName: 'contest',
		indexes: [
			{ fields: ['holder_id'], },
			{ fields: ['ranklist_id'], }
		]
	}
);

let Model = require('./common');
class Contest extends Model {
	static async create(val) {
		return await Contest.fromRecord(Contest.model.build(Object.assign({
			title: '',
			subtitle: '',
			problems: '[]',
			information: '',
			type: 'noi',
			start_time: 0,
			end_time: 0,
			holder_id: 0,
			ranklist_id: 0,
			groups_exlude_config: '[]',
			groups_include_config: '[]'
		}, val)));
	}

	async loadRelationships() {
		this.holder = await User.fromID(this.holder_id);
		this.ranklist = await ContestRanklist.fromID(this.ranklist_id);
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
		gA.sort((a, b) => { return a.id < b.id; });
		gB.sort((a, b) => { return a.id < b.id; });
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
		if (this.holder_id === user.id) return true;
		return await user.haveAccess('contest_manage');
	}

	async isAllowedUseBy(user) {
		if (!user) return false;
		if (this.holder_id === user.id) return true;
		if (await user.haveAccess('contest_manage')) return true;
		if (await this.match(user.groups, this.groups_exlude)) return false;
		if (await this.match(user.groups, this.groups_include)) return true;
		return false;
	}

	async isAllowedSeeResultBy(user) {
		if (this.type == 'ioi' || !(await this.isRunning())) return true;
		if (this.holder_id === user.id) return true;
		return await user.haveAccess('contest_result');
	}

	getProblems() {
		return this.problems;
	}

	setProblemsNoCheck(problems) {
		this.problems = problems;
	}

	async newSubmission(judge_state) {
		let problems = await this.getProblems();
		problems = await problems.mapAsync(x => (x.id));
		if (!problems.includes(judge_state.problem_id)) throw new ErrorMessage('No such problem in the current contest');

		await zoj.utils.lock(['Contest::newSubmission', judge_state.user_id], async () => {
			let player = await ContestPlayer.findInContest({
				contest_id: this.id,
				user_id: judge_state.user_id
			});

			if (!player) {
				player = await ContestPlayer.create({
					contest_id: this.id,
					user_id: judge_state.user_id
				});
			}

			await player.updateScore(judge_state);
			await player.save();

			await this.loadRelationships();
			await this.ranklist.updatePlayer(this, player);
			await this.ranklist.save();
		});
	}

	async isRunning(now) {
		if (!now) now = await zoj.utils.getCurrentDate();
		return now >= this.start_time && now < this.end_time;
	}

	async isEnded(now) {
		if (!now) now = await zoj.utils.getCurrentDate();
		return now >= this.end_time;
	}

	getModel() { return model; }
}

Contest.model = model;

module.exports = Contest;
