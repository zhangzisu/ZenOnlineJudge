'use strict';

let User = zoj.model('user');
let Group = zoj.model('group');
const RatingCalculation = zoj.model('rating_calculation');
const RatingHistory = zoj.model('rating_history');
const Contest = zoj.model('contest');
const ContestPlayer = zoj.model('contest_player');

// Ranklist
app.get('/ranklist', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		const sort = req.query.sort || zoj.config.sorting.ranklist.field;
		const order = req.query.order || zoj.config.sorting.ranklist.order;
		if (!['ac_num', 'rating', 'id', 'username'].includes(sort) || !['asc', 'desc'].includes(order)) {
			throw new ErrorMessage('Illegal sorting parameters.');
		}
		let paginate = zoj.utils.paginate(await User.count({}), req.query.page, zoj.config.page.ranklist);
		let ranklist;
		ranklist = await User.query(paginate, {}, [[sort, order]]);

		res.render('ranklist', {
			ranklist: ranklist,
			paginate: paginate,
			curSort: sort,
			curOrder: order === 'asc'
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/find_user', async (req, res) => {
	try {
		let user = await User.fromName(req.query.nickname);
		if (!user) throw new ErrorMessage('No such user.');
		res.redirect(zoj.utils.makeUrl(['user', user.id]));
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

// Login
app.get('/login', (req, res) => {
	if (res.locals.user) {
		res.render('error', {
			err: new ErrorMessage('Please logout first.', { 'Logout': zoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
		});
	} else {
		res.render('login');
	}
});

// Sign up
app.get('/sign_up', (req, res) => {
	if (res.locals.user) {
		res.render('error', {
			err: new ErrorMessage('Please logout first.', { 'Logout': zoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
		});
	} else {
		res.render('sign_up');
	}
});

// Logout
app.get('/logout', (req, res) => {
	req.session.user_id = null;
	res.clearCookie('login');
	res.redirect('/');
});

// Forget Password

app.get('/forget', (req, res) => {
	res.render('forget');
});

// User page
app.get('/user/:id', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let user = await User.fromID(id);
		if (!user) throw new ErrorMessage('No such user.');
		await user.loadRelationships();

		user.ac_problems = await user.getACProblems();
		user.articles = await user.getArticles();
		user.allowedEdit = await user.isAllowedEditBy(res.locals.user);

		let statistics = await user.getStatistics();
		user.emailVisible = user.public_email || user.allowedEdit;

		const ratingHistoryValues = await RatingHistory.query(null, { user_id: user.id }, [['rating_calculation_id', 'asc']]);
		const ratingHistories = [{
			contestName: 'Basic rating',
			value: zoj.config.default.user.rating,
			delta: null,
			rank: null
		}];

		for (const history of ratingHistoryValues) {
			const contest = await Contest.fromID((await RatingCalculation.fromID(history.rating_calculation_id)).contest_id);
			ratingHistories.push({
				contestName: contest.title,
				value: history.rating_after,
				delta: history.rating_after - ratingHistories[ratingHistories.length - 1].value,
				rank: history.rank,
				participants: await ContestPlayer.count({ contest_id: contest.id })
			});
		}
		ratingHistories.reverse();

		res.render('user', {
			show_user: user,
			statistics: statistics,
			ratingHistories: ratingHistories
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/user/:id/edit', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }

		let id = parseInt(req.params.id);
		let user = await User.fromID(id);
		if (!user) throw new ErrorMessage('No such user.');
		await user.loadRelationships();

		let allowedEdit = await user.isAllowedEditBy(res.locals.user);
		if (!allowedEdit) {
			throw new ErrorMessage('You do not have permission to do this');
		}

		res.locals.user.allowedManage = await res.locals.user.haveAccess('user_edit');

		res.render('user_edit', {
			edited_user: user,
			error_info: null,
			groupAccess: await res.locals.user.haveAccess('user_edit')
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});

app.post('/user/:id/edit', async (req, res) => {
	let user;
	try {
		if (!res.locals.user) { res.redirect('/login'); return; }


		let id = parseInt(req.params.id);
		user = await User.fromID(id);
		if (!user) throw new ErrorMessage('No such user.');

		let allowedEdit = await user.isAllowedEditBy(res.locals.user);
		if (!allowedEdit) throw new ErrorMessage('You do not have permission to do this');

		if (req.body.new_password) {
			if (user.password !== req.body.old_password && !(await res.locals.user.haveAccess('change_password'))) throw new ErrorMessage('Password error.');
			user.password = req.body.new_password;
		}

		if (await res.locals.user.haveAccess('change_username')) {
			if (!zoj.utils.isValidUsername(req.body.username)) throw new ErrorMessage('Invalid user name.');
			user.username = req.body.username;
		}

		user.information = req.body.information;
		user.sex = req.body.sex;
		user.email = req.body.email;
		user.public_email = (req.body.public_email === 'on');
		user.theme = req.body.theme;

		if (await res.locals.user.haveAccess('user_edit')) {
			if (!req.body.groups) req.body.groups = [];
			if (!Array.isArray(req.body.groups)) req.body.groups = [req.body.groups];
			let groups = await req.body.groups.map(x => parseInt(x)).filterAsync(async x => await Group.fromID(x));
			user.group_config = groups;
		}

		await user.save();
		await user.loadRelationships();
		if (user.id === res.locals.user.id) res.locals.user = user;

		res.redirect('/user/' + id);
	} catch (e) {
		await user.loadRelationships();
		res.render('user_edit', {
			edited_user: user,
			error_info: e.message
		});
	}
});
