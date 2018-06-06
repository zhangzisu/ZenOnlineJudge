'use strict';

let randomstring = require('randomstring');
let path = require('path');
let fs = require('fs');

app.get('/pastebin', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		res.render('pastebin');
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/pastebin', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		console.log();
		let content = req.body.content;
		let id = `${parseInt(+new Date())}_${randomstring.generate(10)}_${zoj.utils.md5(content)}`;
		let file = path.join('static', 'pastebin', id);
		fs.writeFileSync(file, content);
		res.render('pastebin', {
			message: id
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});