'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');
let Blog = zoj.model('blog');

let model = db.define('blog_comment',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

		content: { type: Sequelize.TEXT },

		blog_id: { type: Sequelize.INTEGER },

		user_id: { type: Sequelize.INTEGER },

		public_time: { type: Sequelize.INTEGER }
	}, {
		timestamps: false,
		tableName: 'blog_comment',
		indexes: [
			{ fields: ['blog_id'] },
			{ fields: ['user_id'] }
		]
	}
);

let Model = require('./common');
class BlogComment extends Model {
	static async create(val) {
		return await BlogComment.fromRecord(BlogComment.model.build(Object.assign({
			content: '',
			blog_id: 0,
			user_id: 0,
			public_time: 0,
		}, val)));
	}

	async loadRelationships() {
		this.user = await User.fromID(this.user_id);
		this.blog = await Blog.fromID(this.blog_id);
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		await this.loadRelationships();
		if (this.user_id === user.id || user.id === this.blog.user_id) return true;

		return await user.haveAccess('blog_comment_edit');
    }
    
	getModel() { return model; }
}

BlogComment.model = model;

module.exports = BlogComment;
