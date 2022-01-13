const sqlite = require('better-sqlite3');

class SQLite {
	constructor() {}

	_init () {
		this.db = new sqlite('database.db');
	}
	
	_stop() {
		this.db.close();
	}

	get (params) {
		let query = this.db.prepare(params.sql);
		return query.all();
	}

	create(params) {
		let query = this.db.prepare(params.sql);
		query.run();
	}

	delete(params) {
		let query = this.db.prepare(`DELETE FROM ${params.table} WHERE ${params.field} = '${params.value}' ;`);
		query.run();
	}

	insert(params) {
		let query = this.db.prepare(`INSERT INTO ${params.table} (${params.fields}) VALUES (${params.values}) ;`);
		query.run();
	}

	update(params) {
		let query = this.db.prepare(`UPDATE ${params.table} SET '${params.field}' = '${params.value}' WHERE orderId = ${params.id} ;`);
		query.run();
	}

	query (query) {
		this._init();
		switch (query.type) {
		case 'get':
			return this.get(query.obj);
		case 'create':
			this.create(query.obj);
			break;
		case 'delete':
			this.delete(query.obj);
			break;
		case 'insert':
			this.insert(query.obj);
			break;
		case 'update':
			this.update(query.obj);
			break;
		default:
			break;
		}
		this._stop();
	}
}

module.exports = SQLite;
