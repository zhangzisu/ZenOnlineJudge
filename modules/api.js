'use strict';

let User = zoj.model('user');
const Email = require('../libs/email');
const WebToken = require('jsonwebtoken');

function setLoginCookie(username, password, res) {
	res.cookie('login', JSON.stringify([username, password]));
}

// Login
app.post('/api/login', async (req, res) => {
	try {
		res.setHeader('Content-Type', 'application/json');
		let user = await User.fromName(req.body.username);

		if (!user) res.send({
			error_code: 1001
		});
		else if (user.password !== req.body.password) res.send({
			error_code: 1002
		});
		else {
			req.session.user_id = user.id;
			setLoginCookie(user.username, user.password, res);
			res.send({
				error_code: 1
			});
		}
	} catch (e) {
		zoj.error(e);
		res.send({
			error_code: e
		});
	}
});

app.post('/api/forget', async (req, res) => {
	try {
		res.setHeader('Content-Type', 'application/json');
		let user = await User.fromEmail(req.body.email);
		if (!user) throw 1001;
		let sendObj = {
			userId: user.id,
		};

		const token = WebToken.sign(sendObj, zoj.config.session_secret, {
			subject: 'forget',
			expiresIn: '1h'
		});

		const vurl = zoj.config.hostname + zoj.utils.makeUrl(['api', 'forget_confirm'], {
			token: token
		});
		try {
			await Email.send(user.email,
				`Reset password for ${user.username} in ${zoj.config.title}`,
				`<p>Please click the link in 1h to reset your password:</p><p><a href='${vurl}'>${vurl}</a></p><p>.If you are not ${user.username}, please ignore this email.</p>`
			);
		} catch (e) {
			return res.send({
				error_code: 2010,
				message: require('util').inspect(e)
			});
		}

		res.send({
			error_code: 1
		});
	} catch (e) {
		zoj.error(e);
		res.send(JSON.stringify({
			error_code: e
		}));
	}
});

// Sign up
app.post('/api/sign_up', async (req, res) => {
	try {
		res.setHeader('Content-Type', 'application/json');
		let user = await User.fromName(req.body.username);
		if (user) throw 2008;
		user = await User.findOne({
			where: {
				email: req.body.email
			}
		});
		if (user) throw 2009;


		if (!(req.body.email = req.body.email.trim())) throw 2006;
		if (!zoj.utils.isValidUsername(req.body.username)) throw 2002;

		if (zoj.config.register_mail.enabled) {
			let sendObj = {
				username: req.body.username,
				password: req.body.password,
				email: req.body.email,
			};

			const token = WebToken.sign(sendObj, zoj.config.session_secret, {
				subject: 'register',
				expiresIn: '1h'
			});

			const vurl = zoj.config.hostname + zoj.utils.makeUrl(['api', 'sign_up_confirm'], {
				token: token
			});
			try {
				await Email.send(req.body.email,
					`Sign up for ${req.body.username} in ${zoj.config.title}`,
					`<p>Please click the link in 1h to finish your registration in ${zoj.config.title}:</p><p><a href='${vurl}'>${vurl}</a></p><p>If you are not ${req.body.username}, please ignore it.</p>`
				);
			} catch (e) {
				return res.send({
					error_code: 2010,
					message: require('util').inspect(e)
				});
			}

			res.send(JSON.stringify({
				error_code: 2
			}));
		} else {
			user = await User.create({
				username: req.body.username,
				password: req.body.password,
				email: req.body.email,
				public_email: true
			});
			await user.save();

			res.send(JSON.stringify({
				error_code: 1
			}));
		}
	} catch (e) {
		zoj.error(e);
		res.send(JSON.stringify({
			error_code: e
		}));
	}
});

app.get('/api/forget_confirm', async (req, res) => {
	try {
		try {
			await WebToken.verify(req.query.token, zoj.config.session_secret, {
				subject: 'forget'
			});
		} catch (e) {
			throw new ErrorMessage('Token incorrect.');
		}
		res.render('forget_confirm', {
			token: req.query.token
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/api/reset_password', async (req, res) => {
	try {
		res.setHeader('Content-Type', 'application/json');
		let obj;
		try {
			obj = WebToken.verify(req.body.token, zoj.config.session_secret, {
				subject: 'forget'
			});
		} catch (e) {
			throw 3001;
		}

		const user = await User.fromID(obj.userId);
		user.password = req.body.password;
		await user.save();

		res.send(JSON.stringify({
			error_code: 1
		}));
	} catch (e) {
		zoj.error(e);
		if (typeof e === 'number') {
			res.send(JSON.stringify({
				error_code: e
			}));
		} else {
			res.send(JSON.stringify({
				error_code: 1000
			}));
		}
	}
});

app.get('/api/sign_up_confirm', async (req, res) => {
	try {
		let obj;
		try {
			obj = WebToken.verify(req.query.token, zoj.config.session_secret, {
				subject: 'register'
			});
		} catch (e) {
			throw new ErrorMessage('Invalid registration verification link: ' + e.toString());
		}

		let user = await User.fromName(obj.username);
		if (user) throw new ErrorMessage('Username has been used.');
		user = await User.findOne({
			where: {
				email: obj.email
			}
		});
		if (user) throw new ErrorMessage('E-mail address has been used.');

		if (!(obj.email = obj.email.trim())) throw new ErrorMessage('E-mail address cannot be empty.');
		if (!zoj.utils.isValidUsername(obj.username)) throw new ErrorMessage('User name is not valid.');

		user = await User.create({
			username: obj.username,
			password: obj.password,
			email: obj.email,
			public_email: true
		});
		await user.save();

		res.redirect(obj.prevUrl || '/');
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/api/search/problems/:keyword*?', async (req, res) => {
	try {
		let Problem = zoj.model('problem');

		let keyword = req.params.keyword || '';
		let problems = await Problem.query(null,
			{
				title: {
					like: `%${req.params.keyword}%`
				}
			}, [
				['id', 'asc']
			]
		);

		let result = [];

		let id = parseInt(keyword);
		if (id) {
			let problemById = await Problem.fromID(parseInt(keyword));
			await problemById.loadRelationships();
			if (problemById && await problemById.isAllowedUseBy(res.locals.user)) {
				result.push(problemById);
			}
		}
		await problems.forEachAsync(async problem => {
			await problem.loadRelationships();
			if (await problem.isAllowedUseBy(res.locals.user) && result.length < zoj.config.page.edit_contest_problem_list && problem.id !== id) {
				result.push(problem);
			}
		});

		result = result.map(x => ({
			name: `#${x.id}. ${x.title}`,
			value: x.id,
			url: zoj.utils.makeUrl(['problem', x.id])
		}));
		res.send({
			success: true,
			results: result
		});
	} catch (e) {
		zoj.error(e);
		res.send({
			success: false
		});
	}
});

app.get('/api/v2/search/blogs/:keyword*?', async (req, res) => {
	try {
		let BlogPost = zoj.model('blog_post');

		let keyword = req.params.keyword || '';
		let posts;

		if (req.cookies['selfonly_mode'] == '1' && res.locals.user) {
			posts = await BlogPost.query(null, {
				title: { like: `%${req.params.keyword}%` },
				user_id: res.locals.user.id
			}, [['id', 'desc']]);
		} else {
			posts = await BlogPost.query(null, {
				title: { like: `%${req.params.keyword}%` }
			}, [['id', 'desc']]);
		}

		let result = [];

		let id = parseInt(keyword);
		if (id) {
			let postByID = await BlogPost.fromID(parseInt(keyword));
			if (postByID && await postByID.isAllowedSeeBy(res.locals.user)) {
				result.push(postByID);
			}
		}
		await posts.forEachAsync(async post => {
			if (await post.isAllowedSeeBy(res.locals.user) && result.length < zoj.config.page.edit_contest_problem_list && post.id !== id) {
				result.push(post);
			}
		});

		result = result.map(x => ({ name: `#${x.id}. ${x.title}`, value: x.id, url: zoj.utils.makeUrl(['blog', x.id]) }));
		res.send({ success: true, results: result });
	} catch (e) {
		zoj.log(e);
		res.send({ success: false });
	}
});

app.get('/api/search/tags_problem/:keyword*?', async (req, res) => {
	try {
		let ProblemTag = zoj.model('problem_tag');

		let keyword = req.params.keyword || '';
		let tags = await ProblemTag.query(null,
			{
				name: {
					like: `%${keyword}%`
				}
			}, [
				['name', 'asc']
			]
		);

		let result = tags.slice(0, zoj.config.page.edit_problem_tag_list);

		result = result.map(x => ({
			name: x.name,
			value: x.id
		}));
		res.send({
			success: true,
			results: result
		});
	} catch (e) {
		zoj.error(e);
		res.send({
			success: false
		});
	}
});

app.get('/api/search/tags_blog_post/:keyword*?', async (req, res) => {
	try {
		let PostTag = zoj.model('blog_post_tag');

		let keyword = req.params.keyword || '';
		let tags = await PostTag.query(null, {
			name: { like: `%${keyword}%` }
		}, [['name', 'asc']]);

		let result = tags.slice(0, zoj.config.page.edit_post_tag_list);

		result = result.map(x => ({ name: x.name, value: x.id }));
		res.send({ success: true, results: result });
	} catch (e) {
		zoj.log(e);
		res.send({ success: false });
	}
});

let [Fetcher] = require('zoj-contest-fetcher');

app.get('/api/outsidecontests', async (req, res) => {
	try {
		let outsideContests = await Fetcher(10);
		res.send(outsideContests);
	} catch (e) {
		zoj.error(e);
		res.send(e);
	}
});

app.get('/api/search/group/:keyword*?', async (req, res) => {
	try {
		let Group = zoj.model('group');

		let keyword = req.params.keyword || '';
		let groups = await Group.query(null,
			{
				name: {
					like: `%${keyword}%`
				}
			}, [
				['name', 'asc']
			]
		);

		let result = groups.slice(0, zoj.config.page.edit_problem_tag_list);

		result = result.map(x => ({
			name: x.name,
			value: x.id
		}));
		res.send({
			success: true,
			results: result
		});
	} catch (e) {
		zoj.error(e);
		res.send({
			success: false
		});
	}
});

app.get('/api/userrating/:id', async (req, res) => {
	try {
		let id = parseInt(req.params.id);
		let user = await User.fromID(id);
		if (!user) res.send({
			id: id,
			rating: 0
		});
		res.send({
			id: id,
			rating: user.rating
		});
	} catch (e) {
		res.send(e);
	}
});