/*
 *  Package  : models
 *  Filename : blog_post_tag_map.js
 *  Create   : 2018-02-05
 */

'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let model = db.define('blog_post_tag_map', {
	post_id: { type: Sequelize.INTEGER, primaryKey: true },
	tag_id: { type: Sequelize.INTEGER, primaryKey: true	}
}, {
		timestamps: false,
		tableName: 'blog_post_tag_map',
		indexes: [
			{
				fields: ['post_id']
			},
			{
				fields: ['tag_id']
			}
		]
	});

let Model = require('./common');
class ProblemTagMap extends Model {
	static async create(val) {
		return ProblemTagMap.fromRecord(ProblemTagMap.model.build(Object.assign({
			post_id: 0,
			tag_id: 0
		}, val)));
	}

	getModel() { return model; }
}

ProblemTagMap.model = model;

module.exports = ProblemTagMap;
