/*
 *  Package  : modules
 *  Filename : index.js
 *  Create   : 2018-02-05
 */

'use strict';

let User = zoj.model('user');
let Article = zoj.model('article');
let Contest = zoj.model('contest');

app.get('/', async (req, res) => {
	try {
		let ranklist = await User.query([1, 10], { is_show: true }, [['rating', 'desc']]);

		let notices = (await Article.query(null, { is_notice: true }, [['public_time', 'desc']])).map(article => ({
			title: article.title,
			url: zoj.utils.makeUrl(['article', article.id]),
			date: zoj.utils.formatDate(article.public_time, 'L')
		}));

		let where;
		if (res.locals.user && res.locals.user.admin >= 3) where = {}
		else if (res.locals.user && res.locals.user.admin >= 1) where = { is_public: true };
		else where = { $and: { is_public: true, is_protected: false } };

		let contests = await Contest.query([1, 5], where, [['start_time', 'desc']]);

		res.render('index', {
			ranklist: ranklist,
			notices: notices,
			contests: contests,
			links: zoj.config.links
		});
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});

app.get('/help', async (req, res) => {
	try {
		res.render('help');
	} catch (e) {
		zoj.log(e);
		res.render('error', {
			err: e
		});
	}
});
