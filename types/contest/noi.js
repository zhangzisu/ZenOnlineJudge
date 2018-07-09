'use strict';

let JudgeState = zoj.model('judge_state');

let config = {
	allowedSeeCase: false,
	hideResult: true
};

async function calcScore(player, judge_state) {
	if (player.score_details[judge_state.problem_id] && player.score_details[judge_state.problem_id].judge_id > judge_state.id) return player;

	if (!player.score_details[judge_state.problem_id]) player.score_details[judge_state.problem_id] = new Object();
	player.score_details[judge_state.problem_id].score = judge_state.score;
	player.score_details[judge_state.problem_id].judge_id = judge_state.id;

	for (let x of player.contest.problems) {
		if (!player.score_details[x.id]) continue;
		player.score += Math.round(player.score_details[x.id].score / 100 * x.score);
	}

	return player;
}

async function updateRank(players) {
	for (let player of players) {
		player.latest = 0;
		for (let i in player.score_details) {
			if (!player.score_details[i].score) continue;
			let judge_state = await JudgeState.fromID(player.score_details[i].judge_id);
			player.latest = Math.max(player.latest, judge_state.submit_time);
		}
	}

	players.sort((a, b) => {
		if (a.score > b.score) return -1;
		if (b.score > a.score) return 1;
		if (a.latest < b.latest) return -1;
		if (a.latest > b.latest) return 1;
		return 0;
	});

	return players;
}

async function getStatus(player, pid) {
	if (player.score_details[pid]) {
		let judge_state = await JudgeState.fromID(player.score_details[pid].judge_id);
		let status = judge_state.status;

		if (!player.contest.ended && !['Compile Error', 'Waiting', 'Compiling'].includes(status)) {
			status = 'Submitted';
		}
		let judge_id = player.score_details[pid].judge_id;
		return {
			status: status,
			judge_id: judge_id
		};
	} else {
		return null;
	}
}

async function getStatistics(players, pid) {
	let statistics = {
		attempt: 0,
		accepted: 0
	};

	statistics.partially = 0;

	for (let player of players) {
		if (player.score_details[pid]) {
			statistics.attempt++;
			let judge_state = await JudgeState.fromID(player.score_details[pid].judge_id);
			if (judge_state.status === 'Accepted') {
				statistics.accepted++;
			} else if (judge_state.score > 0) {
				statistics.partially++;
			}
		}
	}

	return statistics;
}

module.exports = {
	config: config,
	calcScore: calcScore,
	updateRank: updateRank,
	getStatus: getStatus,
	getStatistics: getStatistics
};
