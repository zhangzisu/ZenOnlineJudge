'use strict';

let BlogPost = zoj.model('blog_post');
let BlogPostTag = zoj.model('blog_post_tag');
let User = zoj.model('user');

app.get('/blogs', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		if (req.cookies['selfonly_mode'] === '1') { res.redirect(`/blogs/user/${res.locals.user.id}`); return; }

		req.cookies['selfonly_mode'] = '0';
		let where = {};

		if (!await res.locals.user.haveAccess('others_blogs')) {
			where = {
				$or: {
					is_public: 1
				}
			};
		}

		let paginate = zoj.utils.paginate(await BlogPost.count(where), req.query.page, zoj.config.page.post);
		let posts = await BlogPost.query(paginate, where, [['id', 'desc']]);

		await posts.forEachAsync(async post => {
			await post.loadRelationships();
			post.allowedEdit = await post.isAllowedEditBy(res.locals.user);
			post.tags = await post.getTags();
		});

		res.render('blog', {
			allowedManageTag: res.locals.user.haveAccess('manage_blog_tag'),
			posts: posts,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blogs/user/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let user = await User.fromID(id);
		if (res.locals.user && id !== res.locals.user.id) req.cookies['selfonly_mode'] = '0';
		if (!user) throw new ErrorMessage('No such user.');
		let where = { user_id: user.id };

		if (user.id !== res.locals.user.id && (!await res.locals.user.haveAccess('others_blogs'))) {
			where = {
				$and: [
					{ is_public: 1 },
					where
				]
			};
		}

		let paginate = zoj.utils.paginate(await BlogPost.count(where), req.query.page, zoj.config.page.post);
		let posts = await BlogPost.query(paginate, where, [['id', 'desc']]);

		await posts.forEachAsync(async post => {
			await post.loadRelationships();
			post.allowedEdit = await post.isAllowedEditBy(res.locals.user);
			post.tags = await post.getTags();
		});

		res.render('blog', {
			allowedManageTag: res.locals.user.haveAccess('manage_blog_tag'),
			posts: posts,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blogs/search', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.query.keyword) || 0;

		let where = {
			$or: {
				title: { like: `%${req.query.keyword}%` },
				id: id
			}
		};
		if (req.cookies['selfonly_mode'] == '1') {
			where = {
				$and: [
					where,
					{ user_id: res.locals.user.id, }
				]
			};
		}
		if (!await res.locals.user.haveAccess('others_blogs')) {
			where = {
				$and: [
					where,
					{ is_public: 1 }
				]
			};
		}

		let order = [zoj.db.literal('`id` = ' + id + ' DESC'), ['id', 'DESC']];

		let paginate = zoj.utils.paginate(await BlogPost.count(where), req.query.page, zoj.config.page.post);
		let posts = await BlogPost.query(paginate, where, order);

		await posts.forEachAsync(async post => {
			post.allowedEdit = await post.isAllowedEditBy(res.locals.user);
			post.tags = await post.getTags();
			await post.loadRelationships();
		});

		res.render('blog', {
			allowedManageTag: res.locals.user.haveAccess('manage_blog_tag'),
			posts: posts,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blogs/tag/:tagIDs', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let tagIDs = Array.from(new Set(req.params.tagIDs.split(',').map(x => parseInt(x))));
		let tags = await tagIDs.mapAsync(async tagID => await BlogPostTag.fromID(tagID));

		// Validate the tagIDs
		for (let tag of tags) {
			if (!tag) {
				return res.redirect(zoj.utils.makeUrl(['blogs']));
			}
		}

		let sql = 'SELECT * FROM `blog_post` WHERE\n';
		for (let tagID of tagIDs) {
			if (tagID !== tagIDs[0]) {
				sql += 'AND\n';
			}

			sql += '`blog_post`.`id` IN (SELECT `post_id` FROM `blog_post_tag_map` WHERE `tag_id` = ' + tagID + ')';
		}

		if (!await res.locals.user.haveAccess('others_blogs')) {
			if (res.locals.user) {
				sql += 'AND (`blog_post`.`is_public` = 1 OR `blog_post`.`user_id` = ' + res.locals.user.id + ')';
			} else {
				sql += 'AND (`blog_post`.`is_public` = 1)';
			}
		}

		let paginate = zoj.utils.paginate(await BlogPost.count(sql), req.query.page, zoj.config.page.post);
		let posts = await BlogPost.query(sql + paginate.toSQL(), {}, [['id', 'desc']]);

		await posts.forEachAsync(async post => {
			await post.loadRelationships();
			post.allowedEdit = await post.isAllowedEditBy(res.locals.user);
			post.tags = await post.getTags();
		});

		res.render('blog', {
			allowedManageTag: res.locals.user.haveAccess('manage_blog_tag'),
			posts: posts,
			tags: tags,
			paginate: paginate
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blog/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let post = await BlogPost.fromID(id);
		if (!post) throw new ErrorMessage('No such post.');

		if (!await post.isAllowedSeeBy(res.locals.user)) {
			throw new ErrorMessage('You do not have permission to do this.');
		}

		post.allowedEdit = await post.isAllowedEditBy(res.locals.user);

		if (post.is_public || post.allowedEdit) {
			post.content = await zoj.utils.markdown(post.content);
		} else {
			throw new ErrorMessage('You do not have permission to do this.');
		}

		post.tags = await post.getTags();
		await post.loadRelationships();

		res.render('post', {
			post: post
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blog/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id) || 0;
		let post = await BlogPost.fromID(id);

		if (!post) {
			if (!res.locals.user) throw new ErrorMessage('Please login.', { 'login': zoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });
			post = await BlogPost.create();
			post.id = id;
			post.allowedEdit = true;
			post.tags = [];
			post.new = true;
		} else {
			if (!await post.isAllowedSeeBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
			post.allowedEdit = await post.isAllowedEditBy(res.locals.user);
			post.tags = await post.getTags();
		}

		res.render('post_edit', {
			post: post
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/blog/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id) || 0;
		let post = await BlogPost.fromID(id);
		if (!post) {
			if (!res.locals.user) throw new ErrorMessage('Please login.', { 'login': zoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

			post = await BlogPost.create();
			post.user_id = res.locals.user.id;

			post.time = zoj.utils.getCurrentDate();
		} else {
			if (!await post.isAllowedSeeBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
			if (!await post.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');
		}

		if (!req.body.title.trim()) throw new ErrorMessage('Title cannot be empty.');
		post.title = req.body.title;
		post.content = req.body.content;
		post.problem_id = req.body.problem_id;
		post.from = req.body.from;

		// Save the post first, to have the `id` allocated
		await post.save();

		if (!req.body.tags) {
			req.body.tags = [];
		} else if (!Array.isArray(req.body.tags)) {
			req.body.tags = [req.body.tags];
		}

		let newTagIDs = await req.body.tags.map(x => parseInt(x)).filterAsync(async x => await BlogPostTag.fromID(x));
		await post.setTags(newTagIDs);

		res.redirect(zoj.utils.makeUrl(['blog', post.id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});


// Set post public
async function setPublic(req, res, is_public) {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let post = await BlogPost.fromID(id);
		if (!post) throw new ErrorMessage('No such post.');

		let allowedEdit = await post.isAllowedEditBy(res.locals.user);
		if (!allowedEdit) throw new ErrorMessage('You do not have permission to do this.');

		post.is_public = is_public;
		await post.save();

		res.redirect(zoj.utils.makeUrl(['blog', id]));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
}

app.post('/blog/:id/public', async (req, res) => {
	await setPublic(req, res, true);
});

app.post('/blog/:id/dis_public', async (req, res) => {
	await setPublic(req, res, false);
});

app.post('/blog/:id/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let post = await BlogPost.fromID(id);
		if (!post) throw new ErrorMessage('No such post.');

		if (!post.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this.');

		await post.delete();

		res.redirect(zoj.utils.makeUrl(['blogs']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});