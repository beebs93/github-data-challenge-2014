var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	_ = require('lodash'),
	moment = require('moment-timezone'),
	async = require('async'),
	request = require('request'),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug'),
	appEvents = require(sAppDir + '/server/system/app-events'),
	redisDb = require(sAppDir + '/server/system/redis-db'),
	wordHelper = require(sAppDir + '/server/helpers/word');

function GithubEventHarvester(){
	this.settings = {
		api: {
			baseUrl: config.github.uris.api.base,
			baseReqOpts: {
				headers: {
					'User-Agent': 'GitHub 2014 Data Challenge'
				},
				method: 'GET',
				qs: {
					client_id: config.github.oauth.clientId,
					client_secret: config.github.oauth.clientSecret
				},
				timeout: config.github.defaults.reqTimeoutMS
			}
		},
		defaults: {
			iterationInterval: config.general.defaults.iterationIntervalMS,
			maxReqsPerHour: config.github.defaults.maxReqsPerHour
		},
		ttl: {
			repo: config.github.ttl.repoSEC,
			word: config.github.ttl.wordSEC
		},
		uris: {
			events: config.github.uris.api.events,
			languages: config.github.uris.api.languages
		},
		wordLimits: {
			min: config.api.limits.minWordLength, 
			max: config.api.limits.maxWordLength
		}
	};

	this.timers = {
		getEvents: null
	};

	this.flags = {
		isGettingEvents: false
	};
};

GithubEventHarvester.prototype = {
	/**
	 * Starts the harvesting process
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	start: function(){
		if(this.flags.isGettingEvents === true){
			debug.warn('Cannot start: Still getting global events');

			return;
		}

		this.stop();

		this._getLatestGlobalEvents();
	},


	/**
	 * Stops the harvesting process
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	stop: function(){
		clearTimeout(this.timers.getEvents);
	},


	/**
	 * Sends the API request to the main /events endpoint
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_getLatestGlobalEvents: function(){
		var _this = this,
			oOpts;

		if(this.flags.isGettingEvents === true){
			debug.warn('Still getting global events');

			return;
		}

		this.flags.isGettingEvents = true;

		oOpts = _.clone(this.settings.api.baseReqOpts);

		_.merge(oOpts, {
			method: 'GET',
			url: this.settings.api.baseUrl + this.settings.uris.events
		});

		request(oOpts, function(err, res, body){
			var iIterationInterval,
				iMaxReqsPerHour,
				aRawEvents,
				iNumEvents;

			_this.flags.isGettingEvents = false;

			iIterationInterval = _this.settings.defaults.iterationInterval;

			// Check for errors
			if(err){
				debug.error(oOpts.url + ' API error ' + err + ' | ' + body);

				_this.timers.getEvents = setTimeout(_this._getLatestGlobalEvents.bind(_this), iIterationInterval);

				return;
			}

			try{
				aRawEvents = JSON.parse(body);

				if(!aRawEvents || !_.isArray(aRawEvents)){
					throw true;
				}
			}
			catch(jsonError){
				aRawEvents = [];
			}

			// To help reduce redundant messages we only look at specific GitHub events
			aRawEvents = _.filter(aRawEvents, function(obj){
				switch(obj.type){
					default:
						return false;

						break;

					case 'IssueCommentEvent':
					case 'IssuesEvent':
					case 'PullRequestEvent':
					case 'PullRequestReviewCommentEvent':
					case 'PushEvent':
						return true;

						break;
				}
			});

			iNumEvents = aRawEvents.length;

			if(iNumEvents === 0){
				debug.info('No important events');

				_this.timers.getEvents = setTimeout(_this._getLatestGlobalEvents.bind(_this), iIterationInterval);

				return;
			}

			// Determine the delay for the next iteration
			iMaxReqsPerHour = parseInt(res.headers['x-ratelimit-limit'], 10);
			iMaxReqsPerHour = iMaxReqsPerHour > 0 ? iMaxReqsPerHour : _this.settings.defaults.maxReqsPerHour;
			iIterationInterval = Math.ceil(3600 / (iMaxReqsPerHour / (1 + iNumEvents)) * 1000);

			//debug.info('Current rate of seconds/iteration: ' + (iIterationInterval / 1000));

			if(res.statusCode === 304){
				debug.info('No new events returned');

				_this.timers.getEvents = setTimeout(_this._getLatestGlobalEvents.bind(_this), iIterationInterval);

				return;
			}

			if(res.statusCode !== 200){
				debug.error(oOpts.url + ' HTTP status code: ' + res.statusCode + ' | ' + body);

				_this.timers.getEvents = setTimeout(_this._getLatestGlobalEvents.bind(_this), iIterationInterval);

				return;
			}

			// Set up the next iteration right away without waiting to finish
			// processing the current batch of events
			_this.timers.getEvents = setTimeout(_this._getLatestGlobalEvents.bind(_this), iIterationInterval);

			// Start processing current batch of events
			if(!aRawEvents || !_.isArray(aRawEvents) || !aRawEvents.length){
				return;
			}

			_.forEach(aRawEvents, _this._processEvent.bind(_this));
		});
	},


	/**
	 * Extracts any pertinent info from a GitHub event
	 * 
	 * @param  object oEvent
	 * @return void
	 * 
	 * @author Brad Beebe
	 */
	_processEvent: function(oEvent){
		var _this = this,
			oRepoBase,
			aRawMessages = [];

		if(!oEvent || !_.isPlainObject(oEvent)){
			return;
		}

		oRepoBase = {
			id: oEvent.repo.id.toString(),
			name: oEvent.repo.name,
			url: 'https:/github.com/' + oEvent.repo.name,
			langsUrl: oEvent.repo.url + this.settings.uris.languages,
			langs: ''
		};

		switch(oEvent.type){
			default:
				return true;

				break;

			case 'IssueCommentEvent':
				if(oEvent.payload.action !== 'created'){
					return true;
				}

				aRawMessages.push({
					text: oEvent.payload.comment.body,
					eventUrl: oEvent.payload.comment.html_url
				});
				
				break;

			case 'IssuesEvent':
				if(oEvent.payload.action !== 'opened'){
					return true;
				}

				aRawMessages.push({
					text: oEvent.payload.issue.title,
					eventUrl: oEvent.payload.issue.html_url
				});

				aRawMessages.push({
					text: oEvent.payload.issue.body,
					eventUrl: oEvent.payload.issue.html_url
				});
				
				break;

			case 'PullRequestEvent':
				if(oEvent.payload.action !== 'opened'){
					return true;
				}

				aRawMessages.push({
					text: oEvent.payload.pull_request.title,
					eventUrl: oEvent.payload.pull_request.html_url
				});

				aRawMessages.push({
					text: oEvent.payload.pull_request.body,
					eventUrl: oEvent.payload.pull_request.html_url
				});

				break;

			case 'PullRequestReviewCommentEvent':
				if(oEvent.payload.action !== 'created'){
					return true;
				}

				aRawMessages.push({
					text: oEvent.payload.comment.body,
					eventUrl: oEvent.payload.comment.html_url
				});

				break;

			case 'PushEvent':
				_.forEach(oEvent.payload.commits, function(oCommit){
					aRawMessages.push({
						text: oCommit.message,
						eventUrl: oRepoBase.url + '/commit/' + oCommit.sha
					});
				});

				break;
		}

		aRawMessages = _.filter(aRawMessages, function(oMsg){
			return _.isString(oMsg.text) && oMsg.text.length;
		});

		if(!aRawMessages.length){
			return;
		}

		this._decorateRepo(oRepoBase, function(err, oRepo){
			var aWords,
				aWordEvents = [],
				oWordEvents = {},
				sWordBatchKey;

			if(err){
				debug.error(oRepoBase.name + ' Could not decorate repo: ' + err);

				return;
			}

			if(!oRepo.langs.length){
				return;
			}

			aWords = _this._parseMessages(aRawMessages);

			if(!aWords.length){
				return;
			}

			
			_.forEach(aWords, function(oWord){
				var dCreated = !oEvent.created_at ? moment() : moment(oEvent.created_at),
					oWordEvent,
					sWordKey;

				oWordEvent = {
					type: oEvent.type,
					url: oWord.eventUrl,
					word: oWord.text,
					timestamp: dCreated.tz('UTC').format('X'),
					repo: {
						name: oRepo.name,
						url: oRepo.url,
						langs: oRepo.langs.split(',')
					}
				};

				aWordEvents.push(oWordEvent);

				// Using two random integers === poor man's entropy
				sWordKey = oWord.text + ':' + oWordEvent.type + '_' + moment().tz('UTC').format('XSSS') + '_' + _.random(1, 9999) + '_' + _.random(1, 9999);

				oWordEvents[sWordKey] = JSON.stringify(oWordEvent);
			});

			appEvents.emit('App:GitHubEvents:Harvested', aWordEvents);

			// Save the current batch of word events in Redis with a relatively
			// short TTL so we always have something to serve up to clients as
			// soon as they connect
			sWordBatchKey = 'wordBatch:' + moment().tz('UTC').format('XSSS') + '_' + _.random(1, 9999) + '_' + _.random(1, 9999);

			redisDb.hmset(sWordBatchKey, oWordEvents);
			redisDb.expire(sWordBatchKey, _this.settings.ttl.word);
		});
	},


	/**
	 * Populates a plain repo object with pertinent metadata
	 * 
	 * @param  object 	oRepoBase
	 * @param  function fnCallbackFinal
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_decorateRepo: function(oRepoBase, fnCallbackFinal){
		var _this = this,
			iRepoId,
			sRepoKey;

		if(!_.isFunction(fnCallbackFinal)){
			fnCallbackFinal = function(){};
		}

		if(!oRepoBase || !_.isPlainObject(oRepoBase)){
			fnCallbackFinal('Invalid base repo object', null);

			return;
		}

		iRepoId = parseInt(oRepoBase.id, 10);

		if(!iRepoId || oRepoBase.id <= 0){
			fnCallbackFinal('Invalid base repo id: ' + oRepoBase.id, null);

			return;
		}

		sRepoKey = 'repos:' + iRepoId;

		async.waterfall([
			// Retrieve any current saved repo data
			function(fnCallback){
				redisDb.hgetall(sRepoKey, function(err, oRepo){
					if(err){
						fnCallback(err);

						return;
					}

					if(!oRepo){
						fnCallback(null, null);

						return;
					}

					fnCallback(null, oRepo);
				});
			},
			// If no saved repo data found, save base repo data in Redis
			function(oRepo, fnCallback){
				if(oRepo){
					fnCallback(null, oRepo);

					return;
				}

				redisDb.hmset(sRepoKey, oRepoBase, function(err){
					if(err){
						fnCallback(err, null);

						return;
					}

					// We only keep repo data for short amount of time as its
					// metadata is not likely to change that much from minute
					// to minute
					redisDb.expire(sRepoKey, _this.settings.ttl.repo);

					fnCallback(null, oRepoBase);
				});
			},
			// If no repo language data found, send a request to its language API endpoint
			function(oRepo, fnCallback){
				var oOpts = _.clone(_this.settings.api.baseReqOpts);

				if(oRepo.langs.length){
					fnCallback(null, oRepo);

					return;
				}

				_.merge(oOpts, {
					method: 'GET',
					url: oRepo.langsUrl
				});

				request(oOpts, function(err, res, body){
					var oResp,
						iLangsTotal,
						aLangs = [];

					if(err){
						fnCallback(err, null);

						return;
					}

					if(res.statusCode !== 200){
						fnCallback(oRepo.langsUrl + ' HTTP status code: ' + res.statusCode + ' | ' + body, null);

						return;
					}

					oResp = JSON.parse(body);

					if(!oResp || !_.isPlainObject(oResp)){
						fnCallback(oRepo.langsUrl + ' invalid API response body | ' + body, null);

						return;
					}

					iLangsTotal = _.reduce(_.values(oResp), function(iSum, iNum){
						return iSum + iNum;
					});

					if(iLangsTotal === 0){
						fnCallback(null, oRepo);

						return;
					}

					_.forIn(oResp, function(iTotal, sLang){
						if((iTotal / iLangsTotal) * 100 < 10){
							return true;
						}

						aLangs.push(sLang);
					});

					oRepo.langs = _.sortBy(aLangs);

					fnCallback(null, oRepo);
				});
			},
			// Save the updated repo data
			function(oRepo, fnCallback){
				// If the language data is a string it means we have already
				// processed it and saved it to Redis
				if(_.isString(oRepo.langs)){
					fnCallback(null, oRepo);

					return;
				}

				if(!_.isArray(oRepo.langs)){
					fnCallback('Invalid repo language data', null);

					return;
				}

				oRepo.langs = oRepo.langs.join(',').trim();

				// Some repos may not have any languags assigned yet so we
				// simply skip saving them for the time being
				if(!oRepo.langs.length){
					fnCallback(null, oRepo);

					return;
				}

				redisDb.hset(sRepoKey, 'langs', oRepo.langs);

				fnCallback(null, oRepo);
			}
		], fnCallbackFinal);
	},


	/**
	 * Breaks up an array of event message objects in individual words
	 * 
	 * @param  array aRawMessages 
	 * @return array aWords
	 *
	 * @author Brad Beebe
	 */
	_parseMessages: function(aRawMessages){
		var _this = this,
			aWords = [];

		if(!aRawMessages || !_.isArray(aRawMessages)){
			return [];
		}

		_.forEach(aRawMessages, function(oMsg){
			var aRawWords;

			if(!oMsg.text.length){
				return true;
			}

			aRawWords = wordHelper.normalizeList(oMsg.text.split(' '));

			aRawWords = _.filter(aRawWords, function(sWord){
				iWordLength = sWord.length;
				
				return iWordLength >= _this.settings.wordLimits.min && iWordLength <= _this.settings.wordLimits.max;
			});

			_.forEach(aRawWords, function(sWord){
				aWords.push({
					text: sWord,
					eventUrl: oMsg.eventUrl
				});
			})
		});

		return aWords;
	}
};

module.exports = new GithubEventHarvester();