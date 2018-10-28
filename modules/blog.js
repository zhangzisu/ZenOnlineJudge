'use strict';

let Blog = zoj.model('blog');
let BlogTag = zoj.model('blog_tag');
let BlogComment = zoj.model('blog_comment');
let User = zoj.model('user');

app.get('/blogs', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();
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

		let paginate = zoj.utils.paginate(await Blog.count(where), req.query.page, zoj.config.page.blog);
		let blogs = await Blog.query(paginate, where, [['id', 'desc']]);

		await blogs.forEachAsync(async blog => {
			await blog.loadRelationships();
			blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);
			blog.tags = await blog.getTags();
			blog.commentsCount = await BlogComment.count({ blog_id: blog.id });
		});

		res.render('blogs', {
			allowedManageTag: await res.locals.user.haveAccess('manage_blog_tag'),
			allowedComment: await res.locals.user.haveAccess('blog_comment'),
			blogs: blogs,
			paginate: paginate,
			enableExport: await res.locals.user.haveAccess('blog_export'),
			exportURL: zoj.utils.makeUrl(['blogs', 'export', 0])
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

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

		let paginate = zoj.utils.paginate(await Blog.count(where), req.query.page, zoj.config.page.blog);
		let blogs = await Blog.query(paginate, where, [['id', 'desc']]);

		await blogs.forEachAsync(async blog => {
			await blog.loadRelationships();
			blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);
			blog.tags = await blog.getTags();
			blog.commentsCount = await BlogComment.count({ blog_id: blog.id });
		});

		res.render('blogs', {
			allowedManageTag: await res.locals.user.haveAccess('manage_blog_tag'),
			blogs: blogs,
			paginate: paginate,
			enableExport: await res.locals.user.haveAccess('blog_export'),
			exportURL: zoj.utils.makeUrl(['blogs', 'export', user.id])
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

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

		let paginate = zoj.utils.paginate(await Blog.count(where), req.query.page, zoj.config.page.blog);
		let blogs = await Blog.query(paginate, where, order);

		await blogs.forEachAsync(async blog => {
			blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);
			blog.tags = await blog.getTags();
			blog.commentsCount = await BlogComment.count({ blog_id: blog.id });
			await blog.loadRelationships();
		});

		res.render('blogs', {
			allowedManageTag: await res.locals.user.haveAccess('manage_blog_tag'),
			blogs: blogs,
			paginate: paginate,
			enableExport: false
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let tagIDs = Array.from(new Set(req.params.tagIDs.split(',').map(x => parseInt(x))));
		let tags = await tagIDs.mapAsync(async tagID => await BlogTag.fromID(tagID));

		// Validate the tagIDs
		for (let tag of tags) {
			if (!tag) {
				return res.redirect(zoj.utils.makeUrl(['blogs']));
			}
		}

		let sql = 'SELECT * FROM `blog` WHERE\n';
		for (let tagID of tagIDs) {
			if (tagID !== tagIDs[0]) {
				sql += 'AND\n';
			}

			sql += '`blog`.`id` IN (SELECT `blog_id` FROM `blog_tag_map` WHERE `tag_id` = ' + tagID + ')';
		}

		if (!await res.locals.user.haveAccess('others_blogs')) {
			if (res.locals.user) {
				sql += 'AND (`blog`.`is_public` = 1 OR `blog`.`user_id` = ' + res.locals.user.id + ')';
			} else {
				sql += 'AND (`blog`.`is_public` = 1)';
			}
		}

		if (req.cookies['selfonly_mode'] == '1') {
			sql += 'AND (`user_id` = ' + res.locals.user.id + ')';
		}

		sql += 'ORDER BY `id` DESC';
		let paginate = zoj.utils.paginate(await Blog.count(sql), req.query.page, zoj.config.page.blog);
		let blogs = await Blog.query(sql + paginate.toSQL(), {});

		await blogs.forEachAsync(async blog => {
			await blog.loadRelationships();
			blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);
			blog.commentsCount = await BlogComment.count({ blog_id: blog.id });
			blog.tags = await blog.getTags();
		});

		res.render('blogs', {
			allowedManageTag: await res.locals.user.haveAccess('manage_blog_tag'),
			blogs: blogs,
			tags: tags,
			paginate: paginate,
			enableExport: false
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id);
		let blog = await Blog.fromID(id);
		if (!blog) throw new ErrorMessage('No such blog.');

		if (!await blog.isAllowedSeeBy(res.locals.user)) {
			throw new ErrorMessage('You do not have permission to do this');
		}

		blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);

		if (blog.is_public || blog.allowedEdit) {
			blog.content = await zoj.utils.markdown(blog.content);
		} else {
			throw new ErrorMessage('You do not have permission to do this');
		}

		let where = { blog_id: id };
		let commentsCount = await BlogComment.count(where);
		let paginate = zoj.utils.paginate(commentsCount, req.query.page, zoj.config.page.blog_comment);
		
		let comments = await BlogComment.query(paginate, where, [['public_time', 'desc']]);

		// zoj.log();

		for (let comment of comments) {
			comment.content = await zoj.utils.markdown(comment.content);
			comment.allowedEdit = await comment.isAllowedEditBy(res.locals.user);
			await comment.loadRelationships();
		}

		blog.tags = await blog.getTags();
		await blog.loadRelationships();

		res.render('blog', {
			blog: blog,
			paginate: paginate,
			allowedComment: await res.locals.user.haveAccess('blog_comment'),
			comments: comments,
			commentsCount: commentsCount
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/blog/:id/comment', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id) || 0;
		let blog = await Blog.fromID(id);

		if (!blog) throw new ErrorMessage('No such a blog.');
		if (!await res.locals.user.haveAccess('blog_comment')) {
			throw new ErrorMessage('Permission denied');
		}

		if (!await res.locals.user.haveAccess('admin') && !blog.is_public) {
			throw new ErrorMessage('Permission denied');
		}
		
		if (req.body.comment.trim().length < 1) throw new ErrorMessage('Comment is too short');

		let comment = await BlogComment.create({
			content: req.body.comment,
			blog_id: id,
			user_id: res.locals.user.id,
			public_time: zoj.utils.getCurrentDate()
		});

		await comment.save();

		res.redirect(zoj.utils.makeUrl(['blog', id]) + '#$');
	} catch(e) {
		zoj.error(e);
		res.render('error', {
			err: e
		})
	}
});

app.post('/blog/:blog_id/comment/:id/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id);
		let comment = await BlogComment.fromID(id);

		if (!comment) {
			throw new ErrorMessage('No such comment');
		} else {
			if (!await comment.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this');
		}

		await comment.destroy();

		res.redirect(zoj.utils.makeUrl(['blog', comment.blog_id]));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blog/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id) || 0;
		let blog = await Blog.fromID(id);

		if (!blog) {
			if (!res.locals.user) throw new ErrorMessage('Please login.', { 'login': zoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });
			blog = await Blog.create();
			blog.id = id;
			blog.allowedEdit = true;
			blog.tags = [];
			blog.new = true;
		} else {
			if (!await blog.isAllowedSeeBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this');
			blog.allowedEdit = await blog.isAllowedEditBy(res.locals.user);
			blog.tags = await blog.getTags();
		}

		res.render('blog_edit', {
			blog: blog
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id) || 0;
		let blog = await Blog.fromID(id);
		if (!blog) {
			if (!res.locals.user) throw new ErrorMessage('Please login.', { 'login': zoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

			blog = await Blog.create();
			blog.user_id = res.locals.user.id;

			blog.time = zoj.utils.getCurrentDate();
		} else {
			if (!await blog.isAllowedSeeBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this');
			if (!await blog.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this');
		}

		if (!req.body.title.trim()) throw new ErrorMessage('Title cannot be empty.');
		blog.title = req.body.title;
		blog.content = req.body.content;
		blog.problem_id = req.body.problem_id;
		blog.from = req.body.from;

		// Save the post first, to have the `id` allocated
		await blog.save();

		if (!req.body.tags) {
			req.body.tags = [];
		} else if (!Array.isArray(req.body.tags)) {
			req.body.tags = [req.body.tags];
		}

		let newTagIDs = await req.body.tags.map(x => parseInt(x)).filterAsync(async x => await BlogTag.fromID(x));
		await blog.setTags(newTagIDs);

		res.redirect(zoj.utils.makeUrl(['blog', blog.id]));
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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id);
		let blog = await Blog.fromID(id);
		if (!blog) throw new ErrorMessage('No such blog.');

		let allowedEdit = await blog.isAllowedEditBy(res.locals.user);
		if (!allowedEdit) throw new ErrorMessage('You do not have permission to do this');

		blog.is_public = is_public;
		await blog.save();

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
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let id = parseInt(req.params.id);
		let blog = await Blog.fromID(id);
		if (!blog) throw new ErrorMessage('No such blog.');

		if (!blog.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('You do not have permission to do this');

		await blog.delete();

		res.redirect(zoj.utils.makeUrl(['blogs']));
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/blogs/export/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();
		if (!await res.locals.user.haveAccess('blog_export'))
			throw new ErrorMessage('Access denied');

		let id = parseInt(req.params.id) || 0;

		let where = { is_public: 1 };
		let user = await User.fromID(id);
		if (user) where.user_id = user.id;
		let blogs = await Blog.query(null, where, [['id', 'desc']]);
		let table = [
			['Blog ID', 'User', 'Motto', 'From', 'Problem ID', 'Problem Title', 'Time', 'Tags', 'Link']
		];
		for (let blog of blogs) {
			await blog.loadRelationships();
			blog.tags = await blog.getTags();

			table.push(
				[
					blog.id,
					blog.user.username,
					blog.user.information,
					blog.from,
					blog.problem_id,
					blog.title,
					zoj.utils.formatDate(blog.time),
					blog.tags.map((x) => { return x.name; }).join(','),
					zoj.config.hostname + zoj.utils.makeUrl(['blog', blog.id])
				]
			);
		}
		let xlsx = require('node-xlsx');
		let tmp = require('tmp-promise');
		let tmpFile = await tmp.file();
		let buffer = xlsx.build([{ name: `Blog_${id}`, data: table }]);
		let fs = require('fs');
		fs.writeFileSync(tmpFile.path, buffer);
		res.download(tmpFile.path, `blog_${id}.xlsx`);
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});