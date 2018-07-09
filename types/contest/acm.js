'use strict';

let config = {
	allowedSeeCase: false,
	hideResult: false,
	noEstimate: true
};

let Contest = zoj.model('contest');

async function calcScore(player, judge_state) {
	if (!judge_state.pending) {
		if (!player.score_details[judge_state.problem_id]) {
			player.score_details[judge_state.problem_id].accepted = false;
			player.score_details[judge_state.problem_id].unacceptedCount = 0;
			player.score_details[judge_state.problem_id].acceptedTime = 0;
			player.score_details[judge_state.problem_id].judge_id = 0;
			player.score_details[judge_state.problem_id].submissions = {};
		}

		player.score_details[judge_state.problem_id].submissions[judge_state.id] = {
			judge_id: judge_state.id,
			accepted: judge_state.status === 'Accepted',
			compiled: judge_state.status !== 'Compile Error',
			time: judge_state.submit_time
			// The time from the the contest began to the user submitted
		};

		let arr = Object.values(player.score_details[judge_state.problem_id].submissions);
		arr.sort((a, b) => a.time - b.time);

		player.score_details[judge_state.problem_id].unacceptedCount = 0;
		player.score_details[judge_state.problem_id].judge_id = 0;
		player.score_details[judge_state.problem_id].accepted = 0;
		for (let x of arr) {
			if (x.accepted) {
				player.score_details[judge_state.problem_id].accepted = true;
				player.score_details[judge_state.problem_id].acceptedTime = x.time;
				player.score_details[judge_state.problem_id].judge_id = x.judge_id;
				break;
			} else if (x.compiled) {
				player.score_details[judge_state.problem_id].unacceptedCount++;
			}
		}

		if (!player.score_details[judge_state.problem_id].accepted) {
			player.score_details[judge_state.problem_id].judge_id = arr[arr.length - 1].judge_id;
		}

		player.score = 0;
		for (let x in player.score_details) {
			if (player.score_details[x].accepted) player.score++;
		}
	}
	return player;
}

async function updateRank(players) {
	if (!players.length) return [];
	let contest = await Contest.fromID(players[0].contest_id);

	for (let player of players) {
		player.timeSum = 0;
		for (let i in player.score_details) {
			if (!player.score_details[i].score) continue;
			if (player.score_details[i].accepted) {
				player.timeSum += (player.score_details[i].acceptedTime - contest.start_time) + (player.score_details[i].unacceptedCount * 20 * 60);
			}
		}
	}

	players.sort((a, b) => {
		if (a.score > b.score) return -1;
		if (b.score > a.score) return 1;
		if (a.timeSum < b.timeSum) return -1;
		if (a.timeSum > b.timeSum) return 1;
		return 0;
	});

	return players;
}

async function getStatus(player, pid) {
	if (player.score_details[pid]) {
		let status = {
			accepted: player.score_details[pid].accepted,
			unacceptedCount: player.score_details[pid].unacceptedCount
		};
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
