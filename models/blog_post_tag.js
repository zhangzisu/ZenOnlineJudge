'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let model = db.define('blog_post_tag',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING },
		color: { type: Sequelize.STRING },
	}, {
		timestamps: false,
		tableName: 'blog_post_tag',
		indexes: [
			{
				unique: true,
				fields: ['name'],
			}
		]
	}
);

let Model = require('./common');
class BlogTag extends Model {
	static async create(val) {
		return BlogTag.fromRecord(BlogTag.model.build(Object.assign({
			name: '',
			color: ''
		}, val)));
	}

	getModel() { return model; }
}

BlogTag.model = model;

module.exports = BlogTag;