/*
 *  Package  : modules
 *  Filename : blog_tag.js
 *  Create   : 2018-02-19
 */

'use strict';

let PostTag = zoj.model('blog_post_tag');

app.get('/blogs/tag/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user || res.locals.user.admin < 2) throw new ErrorMessage('You do not have permission to do this.');

		let id = parseInt(req.params.id) || 0;
		let tag = await PostTag.fromID(id);

		if (!tag) {
			tag = await PostTag.create();
			tag.id = id;
		}

		res.render('post_tag_edit', {
			tag: tag
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/blogs/tag/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user || res.locals.user.admin < 2) throw new ErrorMessage('You do not have permission to do this.');

		let id = parseInt(req.params.id) || 0;
		let tag = await PostTag.fromID(id);

		if (!tag) {
			tag = await PostTag.create();
			tag.id = id;
		}

		req.body.name = req.body.name.trim();
		if (tag.name !== req.body.name) {
			if (await PostTag.findOne({ where: { name: req.body.name } })) {
				throw new ErrorMessage('The label name is already used.');
			}
		}

		tag.name = req.body.name;
		tag.color = req.body.color;

		await tag.save();

		res.redirect(zoj.utils.makeUrl(['blogs', 'tag', tag.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});
