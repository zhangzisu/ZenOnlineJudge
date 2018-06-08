'use strict';

let User = zoj.model('user');
let Article = zoj.model('article');
let Contest = zoj.model('contest');

app.get('/', async (req, res) => {
	try {
		if (!res.locals.user) { res.redirect('/login'); return; } await res.locals.user.loadRelationships();

		let ranklist = await User.query([1, 10], null, [['rating', 'desc']]);

		let notices = (await Article.query([1, 10], { is_notice: true }, [['public_time', 'desc']])).map(article => ({
			title: article.title,
			url: zoj.utils.makeUrl(['article', article.id]),
			date: zoj.utils.formatDate(article.public_time, 'L')
		}));

		let contests = await Contest.query([1, 5], null, [['start_time', 'desc']]);

		await contests.forEachAsync(async x => x.subtitle = await zoj.utils.markdown(x.subtitle));
		contests = await contests.filterAsync(async x => {
			await x.loadRelationships();
			return x.isAllowedUseBy(res.locals.user);
		});

		res.render('index', {
			ranklist: ranklist,
			notices: notices,
			contests: contests,
			links: zoj.config.links
		});
	} catch (e) {
		zoj.error(e);
		res.render('error', {
			err: e
		});
	}
});