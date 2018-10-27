/*
 *  Package  : models
 *  Filename : blog.js
 *  Create   : 2018-02-05
 */
'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let User = zoj.model('user');

let model = db.define('blog',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

		user_id: { type: Sequelize.INTEGER },
		// The id of the user who whote this post
		from: { type: Sequelize.STRING(50) },
		// The source of the problem
		problem_id: { type: Sequelize.STRING(50) },
		// The id of the problem

		title: { type: Sequelize.STRING(80) },
		content: { type: Sequelize.TEXT },
		is_public: { type: Sequelize.BOOLEAN },
		time: { type: Sequelize.INTEGER }
	}, {
		timestamps: false,
		tableName: 'blog',
		indexes: [
			{ fields: ['user_id'], }
		]
	}
);

let Model = require('./common');
class Blog extends Model {
	static async create(val) {
		return await Blog.fromRecord(Blog.model.build(Object.assign({
			user_id: '',
			from: '',
			problem_id: '',
			title: '',
			content: '',
			is_public: false,
			time: 0
		}, val)));
	}

	async loadRelationships() {
		this.user = await User.fromID(this.user_id);
	}

	async isAllowedEditBy(user) {
		if (!user) return false;
		if (this.user_id === user.id) return true;
		return await user.haveAccess('blog_edit');
		// 1.The user is teacher/system admin
		// 2.The user is the owner of this post
	}

	async isAllowedSeeBy(user) {
		if (!user) return false;
		if (await this.is_public) return true;
		if (this.user_id === user.id) return true;
		return await user.haveAccess('others_blogs');
		// 1.The post is public and the user is indoor student
		// 2.The user is teacher/system admin
		// 3.The user is the owner of this post
	}

	async getTags() {
		let BlogTagMap = zoj.model('blog_tag_map');
		let maps = await BlogTagMap.query(null, {
			blog_id: this.id
		});

		let BlogTag = zoj.model('blog_tag');
		let res = await maps.mapAsync(async map => await BlogTag.fromID(map.tag_id));

		res.sort((a, b) => {
			return a.color > b.color ? 1 : -1;
		});

		return res;
	}

	async setTags(newTagIDs) {
		let BlogTagMap = zoj.model('blog_tag_map');

		let oldTagIDs = (await this.getTags()).map(x => x.id);

		let delTagIDs = oldTagIDs.filter(x => !newTagIDs.includes(x));
		let addTagIDs = newTagIDs.filter(x => !oldTagIDs.includes(x));

		for (let tagID of delTagIDs) {
			let map = await BlogTagMap.findOne({
				where: {
					blog_id: this.id,
					tag_id: tagID
				}
			});

			await map.destroy();
		}

		for (let tagID of addTagIDs) {
			let map = await BlogTagMap.create({
				blog_id: this.id,
				tag_id: tagID
			});

			await map.save();
		}
	}

	async delete() {
		await db.query('DELETE FROM `blog`         WHERE `id`      = ' + this.id);
		await db.query('DELETE FROM `blog_tag_map` WHERE `blog_id` = ' + this.id);
		await db.query('DELETE FROM `blog_comment` WHERE `blog_id` = ' + this.id);
	}

	getModel() { return model; }
}

Blog.model = model;

module.exports = Blog;