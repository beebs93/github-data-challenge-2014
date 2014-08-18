"use strict";

var App;

// Avoid 'console' errors in browsers that lack a console.
// https://github.com/h5bp/html5-boilerplate/blob/master/src/js/plugins.js
(function(){
	var method;
	var noop = function(){};
	var methods = [
		'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
		'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
		'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
		'timeStamp', 'trace', 'warn'
	];
	var length = methods.length;
	var console = (window.console = window.console || {});

	while(length--){
		method = methods[length];

		// Only stub undefined methods.
		if(!console[method]){
			console[method] = noop;
		}
	}
}());

(function($){

var $window = $(window),
	Hopper,
	ControlPanel,
	Stage;


/**
 * Main application controller
 * 
 * @param  object oOpts - Options
 * @return void
 *
 * @author Brad Beebe
 */
App = function(oOpts){
	var _this = this;

	this._socket = io(oOpts.socketUrl),
	this._hopper = new Hopper();
	this._cpanel = new ControlPanel();
	this._stage = new Stage();
	this._delays = {
		tick: oOpts.tickDelay,
		stats: oOpts.statsDelay
	};
	this._timers = {
		tick: null,
		stats: null
	};

	this.renderMiniStats = _.throttle(this._cpanel.updateStatsView.bind(this._cpanel), this._delays.stats);

	this._cpanel.signal
		.on('RemoteControl:Click', function(e, oData){
			switch(oData.action){
				default:
					return;

					break;

				case 'play':
					_this._hopper.keepLast(200);

					_this._stage.toggleInspectionMode(false);

					_this._cpanel.clearStats();

					_this._nextTick();

					break;

				case 'pause':
					clearTimeout(_this._timers.tick);

					_this._cpanel.updateStatsView();

					_this._stage.toggleInspectionMode(true);

					break;
			}
		})
		.on('Filter:Languages:Updated', function(e, oData){
			_this._stage.filterActors({
				langs: oData.languages
			});
		})
		.on('Filter:Words:Updated', function(e, oData){
			_this._stage.filterActors({
				words: oData.words
			});
		});

	this._stage.signal
		.on('Actor:Added', function(e, oData){
			var aStats = _this._cpanel.actorToStats(oData.actorData);

			_this._cpanel.addStats(aStats);

			_this.renderMiniStats();
		}).
		on('Actor:Freed', function(e, oData){
			var aStats = _this._cpanel.actorToStats(oData.actorData);

			_this._cpanel.removeStats(aStats);

			_this.renderMiniStats();
		});

	this._socket
		.on('connect_error', function(oError){
			console.error('Could not connect to socketIO server', oError);
		})
		.on('connect', function(){
			var aWordFilters = [
					'and',
					'are',
					'for',
					'from',
					'of',
					'that',
					'the',
					'this',
					'with',
					'use',
					'you'
				];

			console.info('SocketIO connected');

			_this._cpanel.addWordFilters(aWordFilters);

			clearTimeout(_this._timers.tick);

			_this._nextTick.apply(_this);
		})
		.on('App:GitHubEvents:Harvested', function(aWordEvents){
			_this._hopper.add(aWordEvents);
		});
};

App.prototype = {
	/**
	 * Processes the next word event in the hopper
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_nextTick: function(){
		var oActorData,
			oFilters,
			aRepoLangs,
			aValidLangs,
			aLangButtons = [];

		if(this._stage.isInspectionMode()){
			return;
		}

		oActorData = this._hopper.getOne();
		oFilters = this._cpanel.getFilters();

		if(!oActorData || !oActorData.word){
			this._timers.tick = setTimeout(this._nextTick.bind(this), this._delays.tick);

			return;
		}

		// Determine if we need to add any new language filter buttons
		aRepoLangs = _.map(oActorData.repo.langs, function(sLang){
			return sLang.toLowerCase();
		});

		aValidLangs = _.xor(oFilters.langs, aRepoLangs);

		_.forEach(oActorData.repo.langs, function(sLang){
			if(_.indexOf(aValidLangs, sLang.toLowerCase()) === -1){
				return true;
			}

			aLangButtons.push({
				label: sLang,
				value: sLang.toLowerCase()
			});
		});

		this._cpanel.addLanguageButtons(aLangButtons);

		// Add the next item to the stage
		this._stage.addActor(oActorData, {
			filters: this._cpanel.getFilters()
		});

		this._timers.tick = setTimeout(this._nextTick.bind(this), this._delays.tick);
	}
};


/**
 * The queue of word events to be added to the stage
 *
 * @return void
 *
 * @author Brad Beebe
 */
Hopper = function(){
	this._queue = [];
	this._flags = {
		canCollect: true
	};
};

Hopper.prototype = {
	/**
	 * Adds item(s) to the queue
	 * 
	 * @param  mixed items - Single (or array of) word events
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	add: function(items){
		var aItems;

		if(this._flags.canCollect !== true){
			return;
		}

		if(_.isArray(items)){
			aItems = items;
		}else if(_.isPlainObject(items)){
			aItems = [items];
		}else{
			return;
		}

		this._queue = this._queue.concat(aItems);
	},


	/**
	 * Retrives the next item in the queue
	 * 
	 * @return object
	 *
	 * @author Brad Beebe
	 */
	getOne: function(){
		return this._queue.shift();
	},


	/**
	 * Empties the queue
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	empty: function(){
		this._queue = [];
	},


	/**
	 * Removes all but the latest number of items from the queue
	 * 
	 * @param  integer iNumRecentItems 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	keepLast: function(iNumRecentItems){
		this._queue = this._queue.slice(-Math.abs(iNumRecentItems));
	},


	/**
	 * Toggles the hopper to accept/reject new items to the queue
	 * 
	 * @param  string sState
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	toggle: function(sState){
		switch(sState){
			case 'open':
				this._flags.canCollect = true;

				break;

			case 'close':
				this._flags.canCollect = false;

				break;
		}
	}
};


/**
 * Controller for any UI elements
 *
 * @author Brad Beebe
 */
ControlPanel = function(){
	var _this = this,
		$cpanel = $('#control-panel'),
		$langButtons,
		$rcButtons,
		$wordFilters,
		$miniStats;

	if(!$cpanel || $cpanel.length !== 1){
		console.error('Invalid control panel');

		return;
	}

	$langButtons = $cpanel.find('#lang-buttons');

	if(!$langButtons || $langButtons.length !== 1){
		console.error('Missing language buttons container');

		return;
	}

	$rcButtons = $cpanel.find('#remote-control');

	if(!$rcButtons || $rcButtons.length !== 1){
		console.error('Missing remote control buttons container');

		return;
	}

	$wordFilters = $cpanel.find('#words-filter');

	if(!$wordFilters || $wordFilters.length !== 1){
		console.error('Missing word filter container');

		return;
	}

	$miniStats = $cpanel.find('#mini-stats-outer');

	if(!$miniStats || $miniStats.length !== 1){
		console.error('Missing mini stats container');

		return;
	}

	$cpanel
		.on('click', '.global-lang-filter', function(e){
			switch($(this).data('filterAction')){
				default:
					return;

					break;

				case 'none':
					_this._flags.canAutoDisableLangs = false;

					_this._filters.langs = [];

					_this._$langButtons
						.find('li')
						.removeClass('active-filter')
						.data({
							filterStatus: 0
						});

					break;

				case 'all':
					_this._flags.canAutoDisableLangs = true;

					_this._filters.langs = [];

					_this._$langButtons.find('li').each(function(i, el){
						var $el = $(el);

						_this._filters.langs.push($el.data('filterValue'));

						$el
							.addClass('active-filter')
							.data({
								filterStatus: 1
							});
					});

					break;
			}

			_this.signal.trigger('Filter:Languages:Updated', {
				languages: _this._filters.langs
			});
		})
		.on('click', '#remote-control a', function(e){
			var $this = $(this),
				sAction = $this.data('controlAction');

			_this._$rcButtons
				.find('a')
				.removeClass('active-button')
				.not($this)
				.addClass('active-button');

			_this.signal.trigger('RemoteControl:Click', {
				action: sAction
			});
		})
		.on('keyup', '#new-word-filter', function(e){
			if(e.keyCode !== 13){
				return true;
			}

			_this._processWordFilterInput();

			return false;
		})
		.on('click', '#new-word-filter + a', $.proxy(this._processWordFilterInput, this));

	$langButtons
		.on('click', 'li', function(e){
			_this.toggleLanguageFilter($(this));
		});

	$wordFilters
		.on('click', 'li', function(e){
			_this.removeWordFilters($(this).data('filter-value'));
		});

	this.signal = $({});
	this._$cpanel = $cpanel;
	this._$langButtons = $langButtons;
	this._$rcButtons = $rcButtons;
	this._$wordFilters = $wordFilters;
	this._$miniStats = $miniStats;
	this._buttons = {
		langs: []
	};
	this._filters = {
		langs: [],
		words: []
	};
	this._stats = {
		langs: [],
		words: [],
		repos: []
	};
	this._flags = {
		canAutoDisableLangs: false
	};
};

ControlPanel.prototype = {
	/**
	 * Adds the value of the word filter input field to the word filter
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_processWordFilterInput: function(){
		var $input = this._$cpanel.find('#new-word-filter'),
			sWord = $input.val().trim().toLowerCase();

		$input.val('');

		if(!sWord.length){
			return;
		}

		this.addWordFilters(sWord);
	},


	/**
	 * Converts a string to human-friendly stat label
	 * 
	 * @param  string text - Raw string
	 * @return string
	 *
	 * @author Brad Beebe
	 */
	_textToStatLabel: function(text){
		var sLabel;

		if(!_.isString(text)){
			return;
		}

		sLabel = text
					.replace(/[^a-z0-9_#'"\+\-\/]/ig, '')
					.replace(/^'|^"|^/, '')
					.replace(/'$|"$/, '')
					.trim();

		if(!sLabel.length || !sLabel.replace(/\d+/g, '').length){
			return '';
		}

		return sLabel;
	},


	/**
	 * Sorts stat list in numerical order of their value
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_sortStats: function(){
		var _this = this;

		_.forIn(this._stats, function(aStats, sType){
			_this._stats[sType] = _this._stats[sType].sort(function(a, b){
				if(a.value < b.value){
					return 1;
				}

				if(a.value > b.value){
					return -1;
				}

				return 0;
			});
		});
	},



	actorToStats: function(oActorData){
		var aStats = [];

		aStats.push({
			type: 'words',
			label: oActorData.word
		});

		_.forEach(oActorData.repo.langs, function(sLang){
			aStats.push({
				type: 'langs',
				label: sLang
			});
		});

		aStats.push({
			type: 'repos',
			label: oActorData.repo.name,
			url: oActorData.repo.url
		});

		return aStats;
	},



	/**
	 * Returns the list of current language/word filters
	 * 
	 * @return object
	 *
	 * @author Brad Beebe
	 */
	getFilters: function(){
		return this._filters;
	},


	/**
	 * Toggles the status of a language filter button
	 * 
	 * @param  object $el - Language filter button jQuery element 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	toggleLanguageFilter: function($el){
		var oData = $el.data(),
			sLangFilter = oData.filterValue,
			iCurrentStatus = parseInt(oData.filterStatus, 10);

		if(iCurrentStatus === 0){
			$el.addClass('active-filter');

			this._filters.langs.push(sLangFilter);
		}else{
			$el.removeClass('active-filter');

			_.pull(this._filters.langs, sLangFilter);
		}

		$el.data({
			filterStatus: iCurrentStatus === 1 ? 0 : 1
		});

		this.signal.trigger('Filter:Languages:Updated', {
			languages: this._filters.langs
		});

		if(!this._filters.langs.length && this._flags.canAutoDisableLangs === true){
			this._flags.canAutoDisableLangs = false;
		}
	},


	/**
	 * Adds words to the filter
	 * 
	 * @param  mixed words - A single (or array of) words
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	addWordFilters: function(words){
		var _this = this,
			aNewWords,
			aNewItems = [],
			$items;

		if(_.isString(words)){
			words = [words];
		}else if(!_.isArray(words)){
			return;
		}

		aNewWords = _.filter(words, function(sWord){
			return _.indexOf(_this._filters.words, sWord) === -1;
		});

		if(!aNewWords || !aNewWords.length){
			return;
		}

		_.forEach(aNewWords, function(sWord){
			aNewItems.push('<li data-filter-value="' + sWord + '"><i class="fa fa-times"></i> ' + sWord + '</li>');
		});

		this._$wordFilters.append(aNewItems.join(''));

		this._filters.words = this._filters.words.concat(aNewWords);

		this.signal.trigger('Filter:Words:Updated', {
			words: this._filters.words
		});

		// Sort list of word filters alphabetically
		$items = this._$wordFilters.find('li');

		$items.sort(function(a, b){
			var sValueA = a.getAttribute('data-filter-value'),
				sValueB = b.getAttribute('data-filter-value');

			if(sValueA === sValueB){
				return 0;
			}

			return sValueA > sValueB ? 1 : -1;
		});

		$items.detach().appendTo(this._$wordFilters);
	},


	/**
	 * Removes words from the filter
	 * 
	 * @param  mixed words - A single (or array of) words
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	removeWordFilters: function(words){
		var _this = this,
			aNewFilter;

		if(_.isString(words)){
			words = [words];
		}else if(!_.isArray(words)){
			return;
		}

		aNewFilter = _.difference(this._filters.words, words);

		this._$wordFilters.find('li').each(function(i, el){
			var $el = $(el),
				sWordFilter = $el.data('filterValue');

			if(_.indexOf(aNewFilter, sWordFilter) !== -1){
				return true;
			}

			$el.remove();
		});

		this._filters.words = aNewFilter;

		this.signal.trigger('Filter:Words:Updated', {
			words: this._filters.words
		});
	},


	/**
	 * Adds new language filter buttons
	 * 
	 * @param  array aLangButtons
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	addLanguageButtons: function(aLangButtons){
		var _this = this,
			aNewLangs,
			aNewItems = [],
			$items;

		if(!_.isArray(aLangButtons) || !aLangButtons.length){
			return;
		}

		aNewLangs = _.filter(aLangButtons, function(oLang){
			return _.indexOf(_.pluck(_this._buttons.langs, 'value'), oLang.value) === -1;
		});

		if(!aNewLangs || !aNewLangs.length){
			return;
		}

		_.forEach(aNewLangs, function(oLang){
			aNewItems.push('<li data-filter-value="' + oLang.value + '" data-filter-status="0">' + oLang.label + '</li>');

			if(_this._flags.canAutoDisableLangs){
				_this._filters.langs.push(oLang.value);
			}
		});

		$items = $(aNewItems.join(''));

		if(this._flags.canAutoDisableLangs){
			$items
				.addClass('active-filter')
				.data({
					filterStatus: 1
				});
		}

		this._$langButtons.append($items);

		this._buttons.langs = this._buttons.langs.concat(aNewLangs);

		// Sort list of word filters alphabetically
		$items = this._$langButtons.find('li');

		$items.sort(function(a, b){
			var sValueA = a.getAttribute('data-filter-value'),
				sValueB = b.getAttribute('data-filter-value');

			if(sValueA === sValueB){
				return 0;
			}

			return sValueA > sValueB ? 1 : -1;
		});

		$items.detach().appendTo(this._$langButtons);

		// Ugh, I hate this hack
		setTimeout(function(){
			$items.addClass('added');
		}, 100);
	},


	/**
	 * Adds stats to the main list
	 * 
	 * @param  mixed stats - Single (or array of) stat object
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	addStats: function(stats){
		var _this = this,
			aStats2Add;

		if(_.isString(stats)){
			aStats2Add = [stats];
		}else if(_.isArray(stats)){
			aStats2Add = stats;
		}else{
			return;
		}

		_.forEach(aStats2Add, function(oStatI){
			var sLabel,
				iIndex;

			sLabel = _this._textToStatLabel(oStatI.label);

			if(!sLabel.length){
				return true;
			}

			iIndex = _.findIndex(_this._stats[oStatI.type], function(oStatJ){
				return oStatJ.label === sLabel;
			});

			if(iIndex !== -1){
				_this._stats[oStatI.type][iIndex].value++;

				return true;
			}

			_this._stats[oStatI.type].push({
				label: sLabel,
				value: 1,
				url: _.isUndefined(oStatI.url) ? '' : oStatI.url
			});
		});

		this._sortStats();
	},


	/**
	 * Removes stats to the main list
	 * 
	 * @param  mixed stats - Single (or array of) stat object
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	removeStats: function(stats){
		var _this = this,
			aStats2Remove;

		if(_.isString(stats)){
			aStats2Remove = [stats];
		}else if(_.isArray(stats)){
			aStats2Remove = stats;
		}else{
			return;
		}

		_.forEach(aStats2Remove, function(oStatI){
			var sLabel,
				iIndex;

			sLabel = _this._textToStatLabel(oStatI.label);

			if(!sLabel.length){
				return true;
			}

			iIndex = _.findIndex(_this._stats[oStatI.type], function(oStatJ){
				return oStatJ.label === sLabel;
			});

			if(iIndex === -1){
				return true;
			}

			_this._stats[oStatI.type][iIndex].value = Math.max(0, _this._stats[oStatI.type][iIndex].value - 1);
		});

		this._sortStats();
	},


	/**
	 * Clears the list of stats
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	clearStats: function(){
		var _this = this;

		_.forIn(this._stats, function(aStats, sType){
			_this._stats[sType] = [];
		});
	},


	/**
	 * Updates the mini stats view
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	updateStatsView: function(){
		var _this = this,
			aStats = [],
			aLangStats,
			aWordStats,
			aRepoStats,
			iTotalWords;

		aLangStats = _.filter(this._stats.langs, function(oStat){
			return oStat.value > 0;
		});

		aWordStats = _.filter(this._stats.words, function(oStat){
			return oStat.value > 0;
		}).slice(0, 10);

		aRepoStats = _.filter(this._stats.repos, function(oStat){
			return oStat.value > 0;
		});

		aStats.push({
			type: 'langs',
			stats: aLangStats
		});

		aStats.push({
			type: 'words',
			stats: aWordStats
		});

		aStats.push({
			type: 'repos',
			stats: aRepoStats
		});

		_.forEach(aStats, function(oStatsInfo){
			var sType = oStatsInfo.type,
				$statsList = _this._$miniStats.find('#top-' + sType),
				aValues = _.pluck(oStatsInfo.stats, 'value'),
				iTotal;

			iTotal = _.reduce(aValues, function(iSum, iNum){
				return iSum + iNum;
			});

			$statsList
				.find('.stat-item')
				.addClass('out-of-range');

			if(iTotal === 0){
				return true;
			}

			_.forEach(oStatsInfo.stats, function(oStat){
				var nPct = (oStat.value / iTotal) * 100,
					sLabel = oStat.label,
					$statItem = $statsList.filter('[data-stat-type="' + sType + '"][data-stat-label="' + sLabel + '"]'),
					sStatContent;

				if($statItem.length){
					$statItem
						.removeClass('out-of-range')
						.find('.stat-bar')
						.css({
							width: nPct + '%'
						})

					return true;
				}

				if(!oStat.url.length){
					sStatContent = '<div class="stat-label stat-item-child">' + sLabel + '</div>';
				}else{
					sStatContent = '<a class="stat-link stat-item-child" href="' + oStat.url + '" target="_blank"><div class="stat-label">' + sLabel + '</div></a>';
				}

				$statsList.append('<li class="stat-item" data-stat-type="' + oStatsInfo.type + '" data-stat-label="' + sLabel + '"><div class="stat-bar stat-item-child" style="width:' + nPct + '%"></div>' + sStatContent + '</li>');
			});
		});
	}
};


/**
 * Controller for the main stage
 *
 * @author Brad Beebe
 */
Stage = function(){
	var _this = this,
		$stage = $('#stage'),
		$actorTpl;

	if(!$stage || $stage.length !== 1){
		console.error('Invalid stage');

		return;
	}

	$actorTpl = $stage.find('#actor-template');

	if(!$actorTpl || $actorTpl.length !== 1){
		console.error('Invalid stage actor template');

		return;
	}

	this.signal = $({});
	this._$stage = $stage;
	this._actors = [];
	this._$actorTpl = $actorTpl.removeAttr('id').clone(false);
	this._dimensions = {
		stage: {
			width: null,
			height: null
		}
	};
	this._flags = {
		isInspectionMode: false
	};
	this._timers = {
		windowResize: null
	};

	$window.on('resize', function(e){
		clearTimeout(_this._timers.windowResize);

		_this._timers.windowResize = setTimeout(_this._calcDimensions.bind(_this), 500);
	});

	this._calcDimensions();

	$actorTpl.remove();
};

Stage.prototype = {
	/**
	 * Caclulates and records any DOM element dimensions
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_calcDimensions: function(){
		_.merge(this._dimensions, {
			stage: {
				width: this._$stage.outerWidth(),
				height: this._$stage.outerHeight()
			}
		});
	},


	/**
	 * Finds (or creates) a free actor element
	 *
	 * @return object - jQuery element
	 *
	 * @author Brad Beebe
	 */
	_getFreeActor: function(){
		var $actor;

		$actor = _.find(this._actors, function($el){
			if($el._isFree !== true){
				return false;
			}

			$el._isFree = false;

			return true;
		});

		if(_.isUndefined($actor)){
			$actor = this._$actorTpl.clone(false);

			this._actors.push($actor);

			this._$stage.append($actor);
		}

		this._clearActor($actor);

		return $actor;
	},


	/**
	 * Clears an actor's content
	 * 
	 * @param  object $actor - jQuery element
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	_clearActor: function($actor){
		$actor
			.data({
				wordEvent: null
			})
			.removeClass('actor-positioned filter-match')
			.find('.actor-inner')
			.removeClass('layer-1 layer-2 layer-2')
			.find('.event-word, .repo-langs, .event-url, .repo-url')
			.html('')
			.filter('.event-url, .repo-url')
			.attr('href', '#');

		$actor._isFree = false;
	},


	/**
	 * Positions an actor in its starting place
	 * 
	 * @param  object $actor - jQuery element
	 * @return void
	 */
	_positionActor: function($actor){
		var iWidth,
			zIndex = _.random(1, 10),
			sLayerType = 'layer-';

		if(zIndex <= 3){
			sLayerType += '1';
		}else if(zIndex <= 7){
			sLayerType += '2';
		}else{
			sLayerType += '3';
		}

		$actor
			.find('.actor-inner')
			.addClass(sLayerType);

		iWidth = $actor.outerWidth();

		$actor
			.css({
				left: _.random(0, (this._dimensions.stage.width - iWidth)),
				zIndex: zIndex,
				transform: ''
			});
	},


	/**
	 * Adds an actor populated with a single word event's data to the stage
	 * and animates it down to the bottom
	 * 
	 * @param  object oData - Word event
	 * @param  object oOpts - Options
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	addActor: function(oData, oOpts){
		oOpts = oOpts || {};

		var _this = this,
			oFilters = oOpts.filters || {},
			aLangFilters = oFilters.langs || [],
			aWordFilters = oFilters.words || [],
			iHeight,
			iLayerIndex,
			iDuration,
			aLangMatchList,
			aRepoLangs,
			aLangDiff;

		if(!oData || !_.isPlainObject(oData) || this._flags.isInspectionMode === true){
			return;
		}

		if(aLangFilters.length > 0){
			aRepoLangs = _.map(oData.repo.langs, function(sLang){
				return sLang.toLowerCase();
			});

			aLangDiff = _.difference(aRepoLangs, aLangFilters);

			if(aLangDiff.length !== aRepoLangs.length){
				//console.info('Filtered out "' + oData.word + '": Language filter match');

				return;
			}
		}

		if(_.indexOf(aWordFilters, oData.word.toLowerCase()) !== -1){
			//console.info('Filtered out "' + oData.word + '": Word filter match');

			return;
		}

		var $actor = this._getFreeActor();

		$actor
			.data({
				wordEvent: oData
			})
			.find('.event-word')
			.html(oData.word);

		$actor
			.find('.repo-langs')
			.html(oData.repo.langs.join(', '));

		$actor
			.find('.event-url')
			.attr({
				href: oData.url
			})
			.html(oData.type + ' <i class="fa fa-external-link"></i>');

		$actor
			.find('.repo-url')
			.attr({
				href: oData.repo.url
			})
			.html(oData.repo.name + ' <i class="fa fa-external-link"></i>');

		this._positionActor($actor);

		iLayerIndex = parseInt($actor.css('zIndex'), 10);

		if(iLayerIndex <= 3){
			iDuration = _.random(14000, 15000);
		}else if(iLayerIndex <= 7){
			iDuration = _.random(12000, 13000);
		}else{
			iDuration = _.random(10000, 11000);
		}

		iHeight = $actor.outerHeight();

		$actor
			.addClass('actor-positioned')
			.velocity({
				translateY: [(this._dimensions.stage.height + (iHeight * 2)), -iHeight]
			},{
				complete: function(){
					$actor._isFree = true;

					_this.signal.trigger('Actor:Freed', {
						actorData: oData
					});
				},
				duration: iDuration,
				easing: 'linear'
			});

		this.signal.trigger('Actor:Added', {
			actorData: oData
		});
	},


	/**
	 * Iterates through any active actors and filters them out based
	 * on words and/or languages
	 * 
	 * @param  object oFilters (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	filterActors: function(oFilters){
		oFilters = oFilters || {};

		var aRepoLangs,
			aLangMatchList = oFilters.langs || [],
			aWordMatchList = oFilters.words || [],
			iNumLangMatchList = aLangMatchList.length,
			iNumWordsMatchList = aWordMatchList.length;

		_.forEach(this._actors, function($el){
			var oWordEvent = $el.data('wordEvent'),
				aLangDiff,
				bMatchesLangFilter = false,
				bMatchesWordFilter = false;

			if($el._isFree === true || !_.isPlainObject(oWordEvent)){
				return true;
			}

			if(iNumLangMatchList > 0){
				aRepoLangs = _.map(oWordEvent.repo.langs, function(sLang){
					return sLang.toLowerCase();
				});

				aLangDiff = _.difference(aRepoLangs, aLangMatchList);

				bMatchesLangFilter = aLangDiff.length !== aRepoLangs.length;
			}

			if(iNumWordsMatchList > 0){
				bMatchesWordFilter = _.indexOf(aWordMatchList, oWordEvent.word) !== -1;
			}

			if(bMatchesLangFilter || bMatchesWordFilter){
				$el.addClass('filter-match');
			}else{
				$el.removeClass('filter-match');
			}
		});
	},


	/**
	 * Toggles inspection mode of the stage's current active actors
	 * 
	 * @param  boolean bEnable
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	toggleInspectionMode: function(bEnable){
		var $actors;

		switch(bEnable){
			default:
				return;

				break;

			case true:
				$actors = this._$stage
							.find('.actor')
							.velocity('stop');

				$actors.sort(function(a, b){
					var sValueA = $(a).find('.event-word').text(),
						sValueB = $(b).find('.event-word').text();

					if(sValueA === sValueB){
						return 0;
					}

					return sValueA > sValueB ? 1 : -1;
				});

				$actors.detach().appendTo(this._$stage);

				this._actors = _.filter(this._actors, function($el){
					if($el._isFree === true){
						$el.remove();

						return false;
					}

					return true;
				});

				$('body').addClass('inspection-mode');

				break;

			case false:
				this._$stage
					.find('.actor')
					.velocity('stop')
					.remove();

				this._actors = [];

				$('body').removeClass('inspection-mode');

				break;
		}

		this._flags.isInspectionMode = bEnable;
	},


	/**
	 * Determines if inspection mode is currently active
	 * 
	 * @return boolean
	 *
	 * @author Brad Beebe
	 */
	isInspectionMode: function(){
		return this._flags.isInspectionMode;
	}
};

})(jQuery);
