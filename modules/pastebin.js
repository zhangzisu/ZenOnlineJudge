'use strict';

app.get('/pastebin', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		res.send('DDDD');
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});