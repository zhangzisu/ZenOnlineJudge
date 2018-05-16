'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');

let model = db.define('article',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

		title: { type: Sequelize.STRING(80) },
		content: { type: Sequelize.TEXT('medium') },

		user_id: { type: Sequelize.INTEGER },
		problem_id: { type: Sequelize.INTEGER },
		public_time: { type: Sequelize.INTEGER },
		update_time: { type: Sequelize.INTEGER },
		sort_time: { type: Sequelize.INTEGER },

		comments_num: { type: Sequelize.INTEGER },
		allow_comment: { type: Sequelize.BOOLEAN },

		is_notice: { type: Sequelize.BOOLEAN }
	}, {
		timestamps: false,
		tableName: 'article',
		indexes: [
			{ fields: ['user_id'] },
			{ fields: ['sort_time'] }
		]
	}
);

let Model = require('./common');
class Article extends Model {
	static async create(val) {
		return Article.fromRecord(Article.model.build(Object.assign({
			title: '',
			content: '',

			user_id: 0,
			problem_id: 0,

			public_time: 0,
			update_time: 0,
			sort_time: 0,

			comments_num: 0,
			allow_comment: true,

			is_notice: false
		}, val)));
	}

	async loadRelationships() {
		this.user = await User.fromID(this.user_id);
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		if (this.user_id === user.id) return true;

		return await user.haveAccess('article_edit');
	}

	async isAllowedCommentBy(user) {
		if (!user) return false;
		if (this.allow_comment) return true;
		if (this.user_id === user.id) return true;

		return await user.haveAccess('article_comment');
	}

	getModel() { return model; }
};

Article.model = model;

module.exports = Article;
