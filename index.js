'use strict';

var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	_ = require('lodash'),
	connect = require('connect'),
	express = require('express'),
	router = express.Router(),
	serveFavicon = require('serve-favicon'),
	serveStatic = require('serve-static'),
	swig = require('swig'),
	async = require('async'),
	ms = require('ms'),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug'),
	appEvents = require(sAppDir + '/server/system/app-events'),
	redisDb = require(sAppDir + '/server/system/redis-db'),
	tasks = require(sAppDir + '/server/tasks'),
	routes = require(sAppDir + '/server/routes'),
	app,
	io;


/******************************************************************************
 *
 * SERVER SETUP
 * 
 *****************************************************************************/
app = express();
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', sAppDir + '/server/views');
app.set('view cache', false);
swig.setDefaults({
	cache: false
});
app.use(serveFavicon(sAppDir + '/client/public/img/favicon.ico'));
app.use(connect.compress());
app.use(serveStatic(sAppDir + '/client/public', {
	maxAge: ms('1d')
}));
app.use(function(req, res, next){
	var pkg = require(sAppDir + '/package.json');

	_.merge(app.locals, {
		Config: {
			isDebug: req.query.debug === '1',
			socketio: {
				port: config.servers.socketio.port
			},
			version: pkg.version
		}
	});

	next();
});
app.use(router);
app.use(routes.err404);
app.use('*', router);


/******************************************************************************
 *
 * SOCKET I/O SETUP
 * 
 *****************************************************************************/
io = require('socket.io')(config.servers.socketio.port);

io.on('connection', function(){
	debug.info('Client connected', 'socketio');

	// We initially send the client the stored list of the recent word events
	// so that they have something to process while we wait for the next
	// harvest iteration
	async.waterfall([
		function(fnCallbackI){
			redisDb.keys('wordBatch:*', function(err, aKeys){
				if(err){
					aKeys = [];
				}
				
				// We grab just enough recent word events so that by
				// the time they are done processing the latest harvest
				// iteration will have seeded new ones
				aKeys = aKeys.slice(0, 25);

				fnCallbackI(null, aKeys);
			});
		},
		function(aKeys, fnCallbackI){
			var aCallbacks = [];

			_.forEach(aKeys, function(sKey){
				aCallbacks.push(function(fnCallbackJ){
					redisDb.hgetall(sKey, function(err, oWordEvents){
						if(err){
							fnCallbackJ(null, '');

							return;
						}

						fnCallbackJ(null, _.values(oWordEvents));
					});
				});
			});

			async.parallel(aCallbacks, function(err, aWordEventsRaw){
				fnCallbackI(null, _.flatten(aWordEventsRaw));
			});
		}
	], function(err, aWordEventsRaw){
		var aWordEvents = [];

		_.forEach(aWordEventsRaw, function(sWordEvent){
			if(!sWordEvent || !sWordEvent.length){
				return true;
			}

			aWordEvents.push(JSON.parse(sWordEvent));
		});

		io.emit('App:GitHubEvents:Harvested', aWordEvents);
	});
});


/******************************************************************************
 *
 * ROUTES
 * 
 *****************************************************************************/
router.get('/', routes.home);


/******************************************************************************
 *
 * APP START
 * 
 *****************************************************************************/
app.listen(config.servers.http.port);

appEvents.on('App:Redis:DatabaseSet', function(){
	tasks.harvest.start();
});

appEvents.on('App:GitHubEvents:Harvested', function(aWordEvents){
	io.emit('App:GitHubEvents:Harvested', aWordEvents);
});
