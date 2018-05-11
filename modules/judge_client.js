'use strict';

let io = require('socket.io').listen(zoj.config.callback_port);
let dl = require('delivery');
let fs = require('fs-extra');
let WaitingJudge = zoj.model('waiting_judge');
let JudgeState = zoj.model('judge_state');
let Problem = zoj.model('problem');

let judgers = {};

io.sockets.on('connection', function (socket) {
    socket.on('connect', async function (data) {
        if (data.token !== zoj.config.token) {
            // Token incorrect, force disconnect.
            socket.disconnect();
            return;
        }
        let id = parseInt(data.id) || 0;
        if (judgers[id]) {
            // Registeration failed.
            socket.disconnect();
            return;
        }
        judgers[socket.id = id] = socket;
        delivery = dl.listen(socket);
        delivery.connect();
        socket.delivery = delivery;
    });
    socket.on('disconnect', async function (data) {
        let id = socket.id;
        if (judgers.prototype.has(id)) judgers.prototype.delete(id);
    });
    socket.on('free', async function (data) {
        try {
            let judge_state;
            await zoj.utils.lock('judge_peek', async () => {
                let waiting_judge = await WaitingJudge.findOne({ order: [['priority', 'ASC'], ['id', 'ASC']] });
                if (!waiting_judge) {
                    return;
                }

                judge_state = await waiting_judge.getJudgeState();
                await judge_state.loadRelationships();
                await waiting_judge.destroy();
            });

            if (judge_state) {
                let problem = await Problem.fromID(judge_state.problem.id);
                if (problem.testdata_hash == null || problem.testdata_hash == '')
                    await problem.updateTestdataHash();
                socket.emit('task', {
                    judge_id: judge_state.id,
                    code: judge_state.code,
                    language: judge_state.language,
                    pid: judge_state.problem.id,
                    datahash: problem.testdata_hash,
                    config: problem.datainfo
                });
            }
        } catch (e) {
            console.log(e);
            socket.emit('terminate', {});
        }
    });
    socket.on('update', async function (data) {
        try {
            let judge_state = await JudgeState.fromID(data.judge_id);
            if (!judge_state) throw null;
            await judge_state.updateResult(JSON.parse(data.result));
            await judge_state.save();
            await judge_state.updateRelatedInfo();
        } catch (e) {
            console.log(e);
            socket.emit('terminate', {});
        }
    });
    socket.on('require_data', async function (data) {
        try {
            let problem = await Problem.fromID(data.pid);
            if (!problem) throw null;
            if (!await zoj.utils.isFile(problem.getTestdataPath() + '.zip')) {
                await problem.makeTestdataZip();
            }
            let path = require('path');
            let filename = problem.getTestdataPath() + '.zip';
            if (!await zoj.utils.isFile(filename)) return res.status(404).send({ err: 'Permission denied' });
            socket.delivery.send({
                name: path.basename(filename),
                path: filename
            });
            socket.delivery.on('send.success', function (file) {
                console.log('File sent successfully!');
            });
        } catch (e) {
            console.log(e);
            socket.emit('terminate', {});
        }
    });
});

console.log('Judge Client Service started successfully.');