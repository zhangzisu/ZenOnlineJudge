'use strict';

let Problem = zoj.model('problem');
let Article = zoj.model('article');
let ArticleComment = zoj.model('article-comment');

app.get('/discussion', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		let where = { problem_id: null };
		let paginate = zoj.utils.paginate(await Article.count(where), req.query.page, zoj.config.page.discussion);
		let articles = await Article.query(paginate, where, [['public_time', 'desc']]);

		for (let article of articles) await article.loadRelationships();

		res.render('discussion', {
			articles: articles,
			paginate: paginate,
			problem: null
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/problem/:pid/discussion', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		let pid = parseInt(req.params.pid);
		let problem = await Problem.fromID(pid);
		if (!problem) throw new ErrorMessage(res.locals.language, 'No such problem.');
		await problem.loadRelationships();
		if (!await problem.isAllowedUseBy(res.locals.user)) {
			throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
		}

		let where = { problem_id: pid };
		let paginate = zoj.utils.paginate(await Article.count(where), req.query.page, zoj.config.page.discussion);
		let articles = await Article.query(paginate, where, [['public_time', 'desc']]);

		for (let article of articles) await article.loadRelationships();

		res.render('discussion', {
			articles: articles,
			paginate: paginate,
			problem: problem
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/article/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }
		let id = parseInt(req.params.id);
		let article = await Article.fromID(id);
		if (!article) throw new ErrorMessage(res.locals.language, 'No such article.');

		await article.loadRelationships();
		article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
		article.allowedComment = await article.isAllowedCommentBy(res.locals.user);
		article.content = await zoj.utils.markdown(article.content);

		let where = { article_id: id };
		let commentsCount = await ArticleComment.count(where);
		let paginate = zoj.utils.paginate(commentsCount, req.query.page, zoj.config.page.article_comment);

		let comments = await ArticleComment.query(paginate, where, [['public_time', 'desc']]);

		for (let comment of comments) {
			comment.content = await zoj.utils.markdown(comment.content);
			comment.allowedEdit = await comment.isAllowedEditBy(res.locals.user);
			await comment.loadRelationships();
		}

		let problem = null;
		if (article.problem_id) {
			problem = await Problem.fromID(article.problem_id);
			if (!await problem.isAllowedUseBy(res.locals.user)) {
				throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
			}
		}

		res.render('article', {
			article: article,
			comments: comments,
			paginate: paginate,
			problem: problem,
			commentsCount: commentsCount
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/article/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }


		let id = parseInt(req.params.id);
		let article = await Article.fromID(id);

		if (!article) {
			article = await Article.create();
			article.id = 0;
			article.allowedEdit = true;
		} else {
			article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
		}

		res.render('article_edit', {
			article: article,
			fucked: await res.locals.user.haveAccess('set_notice')
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/article/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let article = await Article.fromID(id);

		let time = zoj.utils.getCurrentDate();
		if (!article) {
			article = await Article.create();
			article.user_id = res.locals.user.id;
			article.public_time = article.sort_time = time;

			if (req.query.problem_id) {
				let problem = await Problem.fromID(req.query.problem_id);
				if (!problem) throw new ErrorMessage(res.locals.language, 'No such problem.');
				article.problem_id = problem.id;
			} else {
				article.problem_id = null;
			}
		} else {
			if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
		}

		if (!req.body.title.trim()) throw new ErrorMessage(res.locals.language, 'Title cannot be empty');
		article.title = req.body.title;
		article.content = req.body.content;
		article.update_time = time;
		article.is_notice = res.locals.user.haveAccess('set_bulletin') && req.body.is_notice === 'on';

		await article.save();

		res.redirect(zoj.utils.makeUrl(['article', article.id]));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/article/:id/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let article = await Article.fromID(id);

		if (!article) {
			throw new ErrorMessage(res.locals.language, 'No such article.');
		} else {
			if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
		}

		await article.destroy();

		res.redirect(zoj.utils.makeUrl(['discussion']));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/article/:id/comment', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let article = await Article.fromID(id);

		if (!article) {
			throw new ErrorMessage(res.locals.language, 'No such article.');
		} else {
			if (!await article.isAllowedCommentBy(res.locals.user)) throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
		}

		let comment = await ArticleComment.create({
			content: req.body.comment,
			article_id: id,
			user_id: res.locals.user.id,
			public_time: zoj.utils.getCurrentDate()
		});

		await comment.save();

		res.redirect(zoj.utils.makeUrl(['article', article.id]));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/article/:article_id/comment/:id/delete', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let comment = await ArticleComment.fromID(id);

		if (!comment) {
			throw new ErrorMessage(res.locals.language, 'No such comment');
		} else {
			if (!await comment.isAllowedEditBy(res.locals.user)) throw new ErrorMessage(res.locals.language, 'You do not have permission to do this');
		}

		await comment.destroy();

		res.redirect(zoj.utils.makeUrl(['article', comment.article_id]));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});
