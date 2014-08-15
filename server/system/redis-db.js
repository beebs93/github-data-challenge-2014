var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	redis = require('redis'),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug'),
	appEvents = require(sAppDir + '/server/system/app-events'),
	redisClient = redis.createClient();

redisClient
	.on('connect', function(){
		debug.log('Connected successfully', 'redis');

		appEvents.emit('App:Redis:Connected');
	})
	.on('error', function(err){
		debug.error('Connection error', 'redis');
		debug.error(err, 'redis');

		redisClient.end();

		appEvents.emit('App:Redis:Error');
	})
	.select(config.db.redis.dbIndex, function(){
		debug.log('Database index "' + config.db.redis.dbIndex + '" set', 'redis');

		appEvents.emit('App:Redis:DatabaseSet');
	});

module.exports = redisClient;