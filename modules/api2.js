'use strict';

let [Fetcher] = require('zoj-contest-fetcher');

app.apiRouter.get('/api/outsidecontests', async (req, res) => {
	try {
		let outsideContests = await Fetcher(10);
		res.send(outsideContests);
	} catch (e) {
		zoj.log(e);
		res.send(e);
	}
});

app.apiRouter.post('/api/markdown', async (req, res) => {
	try {
		let s = await zoj.utils.markdown(req.body.s.toString(), null, req.body.noReplaceUI === 'true');
		res.send(s);
	} catch (e) {
		zoj.log(e);
		res.send(e);
	}
});