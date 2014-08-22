'use strict';

var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	redis = require('redis'),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug'),
	appEvents = require(sAppDir + '/server/system/app-events'),
	redisClient = redis.createClient(config.db.redis.port, config.db.redis.host),
	sLog = 'redis';

redisClient
	.on('connect', function(){
		debug.log('Connected successfully', sLog);

		appEvents.emit('App:Redis:Connected');
	})
	.on('error', function(err){
		debug.error('Connection error', sLog);
		debug.error(err, sLog);

		redisClient.end();

		appEvents.emit('App:Redis:Error');
	})
	.select(config.db.redis.dbIndex, function(){
		debug.log('Database index "' + config.db.redis.dbIndex + '" set', sLog);

		appEvents.emit('App:Redis:DatabaseSet');
	});

module.exports = redisClient;