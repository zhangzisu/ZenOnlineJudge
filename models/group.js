'use strict';

let Sequelize = require('sequelize');
let db = zoj.db;

let model = db.define('user_group',
	{
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING },
		config: { type: Sequelize.TEXT, json: true },
	}, {
		timestamps: false,
		tableName: 'user_group',
		indexes: [
			{ unique: true, fields: ['name'], }
		]
	}
);

let Model = require('./common');
class UserGroup extends Model {
	static async create(val) {
		return UserGroup.fromRecord(UserGroup.model.build(Object.assign({
			name: '',
			config: ''
		}, val)));
	}

    async getAccess(name){
        if(this.config[name]){
            return this.config[name];
        }else{
            return this.config[name] = zoj.config.group[name] ? zoj.config.group[name] : false;
        }
    }

	getModel() { return model; }
}

UserGroup.model = model;

module.exports = UserGroup;
