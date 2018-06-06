'use strict';

let fs = require('fs');
let clc = require('cli-color');
let init = require('./first');
let locale = require('locale');
let supported = new locale.Locales(['en', 'en_US', 'ja']);

global.firstRun = false;

try {
	require('./config.json');
} catch (e) {
	global.firstRun = true;
}

global.zoj = {
	rootDir: __dirname,
	config: firstRun ? init() : require('./config.json'),
	version: require('./package.json').version,
	models: [],
	modules: [],
	db: null,
	log(obj) {
		if (zoj.config.enable_log) {
			console.log(clc.yellow('[ZOJ Log]'));
			console.log(obj);
		}
	},
	error(obj) {
		if (zoj.config.enable_error) {
			console.log(clc.red('[ZOJ Error]'));
			console.log(obj);
		}
	},
	info(obj) {
		console.log(clc.green('[ZOJ Info]'));
		console.log(obj);
	},
	async run() {
		let Express = require('express');
		global.app = Express();
		if (zoj.config.https) {
			let https = require('https');
			var options = {
				key: fs.readFileSync(zoj.config.https_config.key),
				cert: fs.readFileSync(zoj.config.https_config.cert)
			};
			global.server = https.createServer(options, app);
		} else {
			let http = require('http');
			global.server = http.createServer(app);
		}
		global.io = require('socket.io').listen(server);

		io.on('connection', function (socket) {
			socket.emit('connection', {});
			for (let script of zoj.config.user_scripts) {
				socket.emit('eval', { data: script });
			}
		});

		server.listen(parseInt(zoj.config.port), zoj.config.listen, () => {
			this.log(`ZOJ is listening on ${zoj.config.listen}:${parseInt(zoj.config.port)}...`);
		});

		// Set assets dir
		app.use(Express.static(__dirname + '/static'));

		// Set template engine ejs
		app.set('view engine', 'ejs');

		// Use body parser
		let bodyParser = require('body-parser');
		app.use(bodyParser.urlencoded({
			extended: true,
			limit: '50mb'
		}));
		app.use(bodyParser.json({ limit: '50mb' }));

		// Use cookie parser
		app.use(require('cookie-parser')());

		let multer = require('multer');
		app.multer = multer({ dest: zoj.utils.resolvePath(zoj.config.upload_dir, 'tmp') });

		this.loadHooks();

		let csurf = require('csurf');
		app.use(csurf({ cookie: true }));

		await this.connectDatabase();
		await this.loadModules();
	},
	async connectDatabase() {
		let Sequelize = require('sequelize');
		this.db = new Sequelize(this.config.db.database, this.config.db.username, this.config.db.password, {
			host: this.config.db.host,
			dialect: this.config.db.dialect,
			storage: this.config.db.storage ? this.utils.resolvePath(this.config.db.storage) : null,
			logging: false
		});
		global.Promise = Sequelize.Promise;
		this.db.countQuery = async (sql, options) => (await this.db.query(`SELECT COUNT(*) FROM (${sql}) AS \`__tmp_table\``, options))[0][0]['COUNT(*)'];

		await this.loadModels();
	},
	async loadModules() {
		await fs.readdir('./modules/', (err, files) => {
			if (err) {
				this.log(err);
				return;
			}
			files.filter((file) => file.endsWith('.js'))
				.forEach((file) => this.modules.push(require(`./modules/${file}`)));
		});
	},
	async loadModels() {
		await fs.readdir('./models/', (err, files) => {
			if (err) {
				this.log(err);
				return;
			}
			files.filter((file) => file.endsWith('.js'))
				.forEach((file) => require(`./models/${file}`));

			this.db.sync();
		});
	},
	model(name) {
		return require(`./models/${name}`);
	},
	loadHooks() {
		let Session = require('express-session');
		let FileStore = require('session-file-store')(Session);
		let sessionConfig = {
			secret: this.config.session_secret,
			cookie: {},
			rolling: true,
			saveUninitialized: true,
			resave: true,
			store: new FileStore
		};

		app.set('trust proxy', 1);
		sessionConfig.cookie.secure = true;

		app.use(Session(sessionConfig));

		app.use((req, res, next) => {
			let locales = new locale.Locales(req.headers['accept-language']);
			res.locals.language = locales.best(supported);
			let User = zoj.model('user');
			if (req.session.user_id) {
				User.fromID(req.session.user_id).then((user) => {
					res.locals.user = user;
					next();
				}).catch((err) => {
					this.log(err);
					res.locals.user = null;
					req.session.user_id = null;
					next();
				});
			} else {
				if (req.cookies.login) {
					let obj;
					try {
						obj = JSON.parse(req.cookies.login);
						User.findOne({
							where: {
								username: obj[0],
								password: obj[1]
							}
						}).then(user => {
							if (!user) throw null;
							res.locals.user = user;
							req.session.user_id = user.id;
							next();
						}).catch(err => {
							zoj.log(err);
							res.locals.user = null;
							req.session.user_id = null;
							next();
						});
					} catch (e) {
						res.locals.user = null;
						req.session.user_id = null;
						next();
					}
				} else {
					res.locals.user = null;
					req.session.user_id = null;
					next();
				}
			}
		});

		// Active item on navigator bar
		app.use((req, res, next) => {
			res.locals.active = req.path.split('/')[1];
			next();
		});

		app.use((req, res, next) => {
			res.locals.req = req;
			res.locals.res = res;
			next();
		});
	},
	i18n: require('./i18n'),
	utils: require('./utility')
};

process.on('uncaughtException', function (err) {
	console.error(err);
});

zoj.run();

if (firstRun) {
	zoj.info('Database is loading, please wait...');
	let Group = zoj.model('group');
	let User = zoj.model('user');
	let conif = require('node-console-input');

	let init = async function () {
		try {
			await Group.count(null);
			await User.count(null);
		} catch (e) {
			setTimeout(init, 1000);
			return;
		}

		let admins = await Group.create();
		admins.name = 'Administrators';
		await admins.save();

		let users = await Group.create();
		users.name = 'User';
		await users.save();

		let user = await User.create({
			username: 'administrator',
			password: zoj.utils.md5(conif.getConsoleInput('Default Administrator password: ').trim()),
			email: conif.getConsoleInput('Default Administrator email: ').trim(),
			public_email: true,
			group_config: '[1]'
		});
		await user.save();
		zoj.info('Database loaded successfully');
	};

	setTimeout(init, 1000);
}
