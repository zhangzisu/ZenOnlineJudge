'use strict';

Array.prototype.forEachAsync = Array.prototype.mapAsync = function (fn) {
	return Promise.all(this.map(fn));
};

Array.prototype.filterAsync = async function (fn) {
	let a = await this.mapAsync(fn);
	return this.filter((x, i) => a[i]);
};

global.ErrorMessage = class ErrorMessage {
	constructor(message, nextUrls, details) {
		this.message = message;
		this.nextUrls = nextUrls || {};
		this.details = details;
	}
};

let Promise = require('bluebird');
let path = require('path');
let fs = Promise.promisifyAll(require('fs-extra'));
let util = require('util');
let moment = require('moment');
let url = require('url');
let querystring = require('querystring');
let gravatar = require('gravatar');
let filesize = require('file-size');
let AsyncLock = require('async-lock');
let marked = require('marked');

function escapeHTML(s) {
	// Code from http://stackoverflow.com/questions/5251520/how-do-i-escape-some-html-in-javascript/5251551
	return s.replace(/[^0-9A-Za-z ]/g, (c) => {
		return '&#' + c.charCodeAt(0) + ';';
	});
}

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = (new JSDOM('')).window;
const DOMPurify = createDOMPurify(window);

module.exports = {
	resolvePath() {
		let a = Array.from(arguments);
		a.unshift(__dirname);
		return path.resolve.apply(null, a);
	},
	async markdown(obj) {
		if (!obj || !obj.trim()) return '';

		try {
			obj = await marked(obj);
			let replaceUI = s =>
				new Promise(function (resolve) {
					s = s.split('<table>').join('<table class="ui celled table">')
						.split('<blockquote>').join('<div class="ui message">').split('</blockquote>').join('</div>');

					resolve(s);
				});
			obj = await DOMPurify.sanitize(obj);
			obj = await replaceUI(obj);
		} catch (e) {
			return 'Markdown parse error';
		}

		return obj;
	},
	formatDate(ts, format) {
		let m = moment(ts * 1000);
		m.locale('eu');
		return m.format(format || 'L H:mm:ss');
	},
	formatTime(x) {
		let sgn = x < 0 ? '-' : '';
		x = Math.abs(x);
		function toStringWithPad(x) {
			x = parseInt(x);
			if (x < 10) return '0' + x.toString();
			else return x.toString();
		}
		return sgn + util.format('%s:%s:%s', toStringWithPad(x / 3600), toStringWithPad(x / 60 % 60), toStringWithPad(x % 60));
	},
	formatSize(x) {
		let res = filesize(x, { fixed: 1 }).calculate();
		if (res.result === parseInt(res.result)) res.fixed = res.result.toString();
		if (res.suffix.startsWith('Byte')) res.suffix = 'B';
		else res.suffix = res.suffix.replace('iB', '');
		return res.fixed + ' ' + res.suffix;
	},
	parseDate(s) {
		return parseInt(+new Date(s) / 1000);
	},
	getCurrentDate(removeTime) {
		let d = new Date;
		if (removeTime) {
			d.setHours(0);
			d.setMinutes(0);
			d.setSeconds(0);
			d.setMilliseconds(0);
		}
		return parseInt(+d / 1000);
	},
	makeUrl(req_params, form) {
		let res = '';
		if (!req_params) res = '/';
		else if (req_params.originalUrl) {
			let u = url.parse(req_params.originalUrl);
			res = u.pathname;
		} else {
			if (!Array.isArray(req_params)) req_params = [req_params];
			for (let param of req_params) res += '/' + param;
		}
		let encoded = querystring.encode(form);
		if (encoded) res += '?' + encoded;
		return res;
	},
	escapeHTML: escapeHTML,
	async highlight(code, lang) {
		code = await escapeHTML(code);
		return `<pre class="language-${lang}" style="box-shadow: none;"><code class="language-${lang}">${code}</code></pre>`;
	},
	gravatar(email, size) {
		return gravatar.url(email, { s: size, d: 'mm' });
	},
	ansiToHTML(s) {
		let Convert = require('ansi-to-html');
		let convert = new Convert({ escapeXML: true });
		return convert.toHtml(s);
	},
	paginate(count, currPage, perPage) {
		currPage = parseInt(currPage);
		if (!currPage || currPage < 1) currPage = 1;

		let pageCnt = Math.ceil(count / perPage);
		if (currPage > pageCnt) currPage = pageCnt;

		return {
			currPage: currPage,
			perPage: perPage,
			pageCnt: pageCnt,
			toSQL: () => {
				if (!pageCnt) return '';
				else return ` LIMIT ${(currPage - 1) * perPage},${perPage}`;
			}
		};
	},
	removeTitleTag(s) {
		return s.replace(/[[\S\s]+?]/, '');
	},
	md5(data) {
		let crypto = require('crypto');
		let md5 = crypto.createHash('md5');
		md5.update(data);
		return md5.digest('hex');
	},
	isValidUsername(s) {
		return /^[a-zA-Z0-9]+$/.test(s);
	},
	locks: [],
	lock(key, cb) {
		let s = JSON.stringify(key);
		if (!this.locks[s]) this.locks[s] = new AsyncLock();
		return this.locks[s].acquire(s, cb);
	},
	encrypt(buffer, password) {
		if (typeof buffer === 'string') buffer = Buffer.from(buffer);
		let crypto = require('crypto');
		let cipher = crypto.createCipher('aes-256-ctr', password);
		return Buffer.concat([cipher.update(buffer), cipher.final()]);
	},
	decrypt(buffer, password) {
		let crypto = require('crypto');
		let decipher = crypto.createDecipher('aes-256-ctr', password);
		return Buffer.concat([decipher.update(buffer), decipher.final()]);
	},
	async isFile(path) {
		try {
			return (await fs.statAsync(path)).isFile();
		} catch (e) {
			return false;
		}
	},
	async isDir(path) {
		try {
			return (await fs.statAsync(path)).isDirectory();
		} catch (e) {
			return false;
		}
	},
	async saveConfig() {
		let fs = require('fs-extra');
		await fs.writeFileAsync(zoj.rootDir + '/config.json', JSON.stringify(zoj.config, null, 2));
	}
};
