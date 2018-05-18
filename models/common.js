'use strict';

class Model {
	constructor(record) {
		this.record = record;
		this.loadFields();
	}

	loadFields() {
		let model = this.getModel();
		let obj = JSON.parse(JSON.stringify(this.record.get({ plain: true })));
		for (let key in obj) {
			if (model.tableAttributes[key].json) {
				try {
					this[key] = eval(`(${obj[key]})`);
				} catch (e) {
					this[key] = {};
				}
			} else this[key] = obj[key];
		}
	}

	toPlain() {
		let model = this.getModel();
		let obj = JSON.parse(JSON.stringify(this.record.get({ plain: true })));
		for (let key in obj) {
			if (model.tableAttributes[key].json) obj[key] = JSON.stringify(this[key]);
			else obj[key] = this[key];
		}
		return obj;
	}

	async save() {
		let obj = this.toPlain();
		for (let key in obj) this.record.set(key, obj[key]);

		let isNew = this.record.isNewRecord;
		await this.record.save();
		if (!isNew) return;

		await this.reload();
	}

	async reload() {
		await this.record.reload();
		this.loadFields();
	}

	async destroy() {
		return await this.record.destroy();
	}

	static async fromRecord(record) {
		record = await record;
		if (!record) return null;
		return new this(await record);
	}

	static async fromID(id) {
		return await this.fromRecord(this.model.findById(id));
	}

	static async findOne(options) {
		return await this.fromRecord(this.model.findOne(options));
	}

	static async all() {
		return (await this.model.findAll()).mapAsync(record => (this.fromRecord(record)));
	}

	static async count(where) {
		// count(sql)
		if (typeof where === 'string') {
			let sql = where;
			return await zoj.db.countQuery(sql);
		}

		// count(where)
		return await this.model.count({ where: where });
	}

	static async query(paginate, where, order) {
		let records = [];

		if (typeof paginate === 'string') {
			// query(sql)
			let sql = paginate;
			records = await zoj.db.query(sql, { model: this.model });
		} else {
			if (paginate && !Array.isArray(paginate) && !paginate.pageCnt) return [];

			let options = {
				where: where,
				order: order
			};
			if (Array.isArray(paginate)) {
				options.offset = paginate[0] - 1;
				options.limit = paginate[1] - paginate[0] + 1;
			} else if (paginate) {
				options.offset = (paginate.currPage - 1) * paginate.perPage;
				options.limit = parseInt(paginate.perPage);
			}

			records = await this.model.findAll(options);
		}

		return records.mapAsync(record => (this.fromRecord(record)));
	}
}

module.exports = Model;
