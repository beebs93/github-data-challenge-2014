'use strict';

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
	var _this = this,
		socket,
		hopper,
		cpanel,
		stage,
		oDelays,
		oTimers;


	/**
	 * Constructor init callback
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function init(oOpts){
		hopper = new Hopper();
		cpanel = new ControlPanel();
		stage = new Stage();
		socket = io(oOpts.socketUrl);

		oDelays = {
			tick: oOpts.delays.tick,
			stats: oOpts.delays.stats,
			lastEventDate: oOpts.delays.lastEventDate,
			gc: oOpts.delays.gc
		};

		oTimers = {
			tick: null,
			stats: null
		};

		_this.renderMiniStats = _.throttle(cpanel.updateStatsView.bind(cpanel), oDelays.stats);
		_this.renderLastEventDate = _.throttle(cpanel.updateLastEventDate.bind(cpanel), oDelays.lastEventDate);
		_this.runGC = _.throttle(stage.gc.bind(stage), oDelays.gc);

		cpanel.signal
			.on('RemoteControl:Click', function(e, oData){
				switch(oData.action){
					default:
						return;

					case 'play':
						hopper.keepLast(200);

						stage.toggleInspectionMode(false);

						cpanel.clearStats();
						cpanel.updateStatsView();

						nextTick();

						break;

					case 'pause':
						clearTimeout(oTimers.tick);

						cpanel.updateStatsView();

						stage.toggleInspectionMode(true);

						break;

					case 'clear-all':
						hopper.empty();

						stage.empty();

						cpanel.clearStats();
						cpanel.updateStatsView();
						cpanel.updateLastEventDate(null);

						break;
				}
			})
			.on('Filter:Languages:Updated', function(e, oData){
				stage.filterActors({
					langs: oData.languages
				});
			})
			.on('Filter:Words:Updated', function(e, oData){
				stage.filterActors({
					words: oData.words
				});
			});

		stage.signal
			.on('Actor:Added', function(e, oData){
				var aStats;

				if(oData.isFilterMatch === true){
					return;
				}

				aStats = cpanel.actorToStats(oData.actorData);

				cpanel.addStats(aStats);

				_this.renderMiniStats();
				_this.renderLastEventDate(oData.actorData.timestamp);
			}).
			on('Actor:Freed', function(e, oData){
				var aStats;

				if(oData.isFilterMatch === true){
					return;
				}

				aStats = cpanel.actorToStats(oData.actorData);

				cpanel.removeStats(aStats);

				_this.renderMiniStats();
			});

		socket
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

				cpanel.addWordFilters(aWordFilters);

				clearTimeout(oTimers.tick);

				nextTick.apply(_this);
			})
			.on('App:GitHubEvents:Harvested', function(aWordEvents){
				hopper.add(aWordEvents);
			});
	}
	

	/**
	 * Processes the next word event in the hopper
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function nextTick(){
		var oActorData,
			oFilters,
			aRepoLangs,
			aValidLangs,
			aLangButtons = [];

		_this.runGC();

		if(stage.isInspectionModeActive()){
			return;
		}

		oActorData = hopper.getOne();
		oFilters = cpanel.getFilters();

		if(!oActorData || !oActorData.word){
			oTimers.tick = setTimeout(nextTick.bind(_this), oDelays.tick);

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

		cpanel.addLanguageButtons(aLangButtons);

		// Add the next item to the stage
		stage.addActor(oActorData, {
			filters: cpanel.getFilters()
		});

		oTimers.tick = setTimeout(nextTick.bind(_this), oDelays.tick);
	}


	init(oOpts);
};



/**
 * The queue of word events to be added to the stage
 *
 * @return void
 *
 * @author Brad Beebe
 */
Hopper = function(){
	var _this = this,
		aQueue,
		oFlags;


	/**
	 * Constructor init callback
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function init(){
		aQueue = [];

		oFlags = {
			canCollect: true
		};
	}


	/**
	 * Adds item(s) to the queue
	 * 
	 * @param  mixed items - Single (or array of) word events
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.add = function(items){
		var aItems;

		if(oFlags.canCollect !== true){
			return;
		}

		if(_.isArray(items)){
			aItems = items;
		}else if(_.isPlainObject(items)){
			aItems = [items];
		}else{
			return;
		}

		aQueue = aQueue.concat(aItems);
	};


	/**
	 * Retrives the next item in the queue
	 * 
	 * @return object
	 *
	 * @author Brad Beebe
	 */
	this.getOne = function(){
		return aQueue.shift();
	};


	/**
	 * Empties the queue
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.empty = function(){
		aQueue = [];
	};


	/**
	 * Removes all but the latest number of items from the queue
	 * 
	 * @param  integer iNumRecentItems 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.keepLast = function(iNumRecentItems){
		aQueue = aQueue.slice(-Math.abs(iNumRecentItems));
	};


	/**
	 * Toggles the hopper to accept/reject new items to the queue
	 * 
	 * @param  string sState
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.toggle = function(sState){
		switch(sState){
			case 'open':
				oFlags.canCollect = true;

				break;

			case 'close':
				oFlags.canCollect = false;

				break;
		}
	};


	init();
};



/**
 * Controller for any UI elements
 *
 * @author Brad Beebe
 */
ControlPanel = function(){
	var _this = this,
		$cpanel,
		$langButtons,
		$rcButtons,
		$wordFilters,
		$miniStats,
		$lastEventDate,
		oButtons,
		oFilters,
		oStats,
		oFlags;

	/**
	 * Constructor init callback
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function init(){
		_this.signal = $({});

		oButtons = {
			langs: []
		};

		oFilters = {
			langs: [],
			words: []
		};

		oStats = {
			langs: [],
			words: [],
			repos: []
		};

		oFlags = {
			canAutoDisableLangs: false
		};

		$cpanel = $('#control-panel');

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

		$lastEventDate = $cpanel.find('#last-event-date');

		if(!$lastEventDate || $lastEventDate.length !== 1){
			console.error('Missing last event date container');

			return;
		}

		$cpanel
			.on('click', '.global-lang-filter', function(e){
				switch($(this).data('filterAction')){
					default:
						return;

					case 'none':
						oFlags.canAutoDisableLangs = false;

						oFilters.langs = [];

						$langButtons
							.find('li')
							.removeClass('active-filter')
							.data({
								filterStatus: 0
							});

						break;

					case 'all':
						oFlags.canAutoDisableLangs = true;

						oFilters.langs = [];

						$langButtons.find('li').each(function(i, el){
							var $el = $(el);

							oFilters.langs.push($el.data('filterValue'));

							$el
								.addClass('active-filter')
								.data({
									filterStatus: 1
								});
						});

						break;
				}

				_this.signal.trigger('Filter:Languages:Updated', {
					languages: oFilters.langs
				});
			})
			.on('click', '#remote-control .toggle-button', function(e){
				var $this = $(this),
					sAction = $this.data('toggleAction');

				$rcButtons
					.find('a')
					.removeClass('active-button')
					.not($this)
					.addClass('active-button');

				_this.signal.trigger('RemoteControl:Click', {
					action: sAction
				});
			})
			.on('click', '#remote-control #clear-all', function(e){
				_this.signal.trigger('RemoteControl:Click', {
					action: 'clear-all'
				});
			})
			.on('keyup', '#new-word-filter', function(e){
				if(e.keyCode !== 13){
					return true;
				}

				processWordFilterInput();

				return false;
			});

		$langButtons
			.on('click', 'li', function(e){
				_this.toggleLanguageFilter($(this));
			});

		$wordFilters
			.on('click', 'li', function(e){
				_this.removeWordFilters($(this).data('filter-value'));
			});
	}


	/**
	 * Adds the value of the word filter input field to the word filter
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function processWordFilterInput(){
		var $input = $cpanel.find('#new-word-filter'),
			sWord = $input.val().trim().toLowerCase();

		$input.val('');

		if(!sWord.length){
			return;
		}

		_this.addWordFilters(sWord);
	}


	/**
	 * Converts a string to human-friendly stat label
	 * 
	 * @param  string text - Raw string
	 * @return string
	 *
	 * @author Brad Beebe
	 */
	function textToStatLabel(text){
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
	}


	/**
	 * Sorts stat list in numerical order of their value
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function sortStats(){
		_.forIn(oStats, function(aStats, sType){
			oStats[sType] = oStats[sType].sort(function(a, b){
				if(a.value < b.value){
					return 1;
				}

				if(a.value > b.value){
					return -1;
				}

				return 0;
			});
		});
	}


	/**
	 * Breaks down an actor's data into an array of pertinent stat objects
	 * 
	 * @param  object oActorData
	 * @return array
	 *
	 * @author Brad Beebe
	 */
	this.actorToStats = function(oActorData){
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
	};


	/**
	 * Returns the list of current language/word filters
	 * 
	 * @return object
	 *
	 * @author Brad Beebe
	 */
	this.getFilters = function(){
		return oFilters;
	};


	/**
	 * Toggles the status of a language filter button
	 * 
	 * @param  object $el - Language filter button jQuery element 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.toggleLanguageFilter = function($el){
		var oData = $el.data(),
			sLangFilter = oData.filterValue,
			iCurrentStatus = parseInt(oData.filterStatus, 10);

		if(iCurrentStatus === 0){
			$el.addClass('active-filter');

			oFilters.langs.push(sLangFilter);
		}else{
			$el.removeClass('active-filter');

			_.pull(oFilters.langs, sLangFilter);
		}

		$el.data({
			filterStatus: iCurrentStatus === 1 ? 0 : 1
		});

		this.signal.trigger('Filter:Languages:Updated', {
			languages: oFilters.langs
		});

		if(!oFilters.langs.length && oFlags.canAutoDisableLangs === true){
			oFlags.canAutoDisableLangs = false;
		}
	};


	/**
	 * Adds words to the filter
	 * 
	 * @param  mixed words - A single (or array of) words
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.addWordFilters = function(words){
		var aNewWords,
			aNewItems = [],
			$items;

		if(_.isString(words)){
			words = [words];
		}else if(!_.isArray(words)){
			return;
		}

		aNewWords = _.filter(words, function(sWord){
			return _.indexOf(oFilters.words, sWord) === -1;
		});

		if(!aNewWords || !aNewWords.length){
			return;
		}

		_.forEach(aNewWords, function(sWord){
			aNewItems.push('<li data-filter-value="' + sWord + '" title="Removes this word from the filter list"><i class="fa fa-times"></i> ' + sWord + '</li>');
		});

		$wordFilters.append(aNewItems.join(''));

		oFilters.words = oFilters.words.concat(aNewWords);

		this.signal.trigger('Filter:Words:Updated', {
			words: oFilters.words
		});

		// Sort list of word filters alphabetically
		$items = $wordFilters.find('li');

		$items.sort(function(a, b){
			var sValueA = a.getAttribute('data-filter-value'),
				sValueB = b.getAttribute('data-filter-value');

			if(sValueA === sValueB){
				return 0;
			}

			return sValueA > sValueB ? 1 : -1;
		});

		$items.detach().appendTo($wordFilters);
	};


	/**
	 * Removes words from the filter
	 * 
	 * @param  mixed words - A single (or array of) words
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.removeWordFilters = function(words){
		var aNewFilter;

		if(_.isString(words)){
			words = [words];
		}else if(!_.isArray(words)){
			return;
		}

		aNewFilter = _.difference(oFilters.words, words);

		$wordFilters.find('li').each(function(i, el){
			var $el = $(el),
				sWordFilter = $el.data('filterValue');

			if(_.indexOf(aNewFilter, sWordFilter) !== -1){
				return true;
			}

			$el.remove();
		});

		oFilters.words = aNewFilter;

		this.signal.trigger('Filter:Words:Updated', {
			words: oFilters.words
		});
	};


	/**
	 * Adds new language filter buttons
	 * 
	 * @param  array aLangButtons
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.addLanguageButtons = function(aLangButtons){
		var aNewLangs,
			aNewItems = [],
			$items;

		if(!_.isArray(aLangButtons) || !aLangButtons.length){
			return;
		}

		aNewLangs = _.filter(aLangButtons, function(oLang){
			return _.indexOf(_.pluck(oButtons.langs, 'value'), oLang.value) === -1;
		});

		if(!aNewLangs || !aNewLangs.length){
			return;
		}

		_.forEach(aNewLangs, function(oLang){
			aNewItems.push('<li data-filter-value="' + oLang.value + '" data-filter-status="0" title="Toggles filtering out this language\'s words">' + oLang.label + '</li>');

			if(oFlags.canAutoDisableLangs){
				oFilters.langs.push(oLang.value);
			}
		});

		$items = $(aNewItems.join(''));

		if(oFlags.canAutoDisableLangs){
			$items
				.addClass('active-filter')
				.data({
					filterStatus: 1
				});
		}

		$langButtons.append($items);

		oButtons.langs = oButtons.langs.concat(aNewLangs);

		// Sort list of word filters alphabetically
		$items = $langButtons.find('li');

		$items.sort(function(a, b){
			var sValueA = a.getAttribute('data-filter-value'),
				sValueB = b.getAttribute('data-filter-value');

			if(sValueA === sValueB){
				return 0;
			}

			return sValueA > sValueB ? 1 : -1;
		});

		$items.detach().appendTo($langButtons);

		// Ugh, I hate this hack
		setTimeout(function(){
			$items.addClass('added');
		}, 100);
	};


	/**
	 * Adds stats to the main list
	 * 
	 * @param  mixed stats - Single (or array of) stat object
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.addStats = function(stats){
		var aStats2Add;

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

			sLabel = textToStatLabel(oStatI.label);

			if(!sLabel.length){
				return true;
			}

			iIndex = _.findIndex(oStats[oStatI.type], function(oStatJ){
				return oStatJ.label === sLabel;
			});

			if(iIndex !== -1){
				oStats[oStatI.type][iIndex].value++;

				return true;
			}

			oStats[oStatI.type].push({
				label: sLabel,
				value: 1,
				url: _.isUndefined(oStatI.url) ? '' : oStatI.url
			});
		});

		sortStats();
	};


	/**
	 * Removes stats to the main list
	 * 
	 * @param  mixed stats - Single (or array of) stat object
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.removeStats = function(stats){
		var aStats2Remove;

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

			sLabel = textToStatLabel(oStatI.label);

			if(!sLabel.length){
				return true;
			}

			iIndex = _.findIndex(oStats[oStatI.type], function(oStatJ){
				return oStatJ.label === sLabel;
			});

			if(iIndex === -1){
				return true;
			}

			oStats[oStatI.type][iIndex].value = Math.max(0, oStats[oStatI.type][iIndex].value - 1);
		});

		sortStats();
	};


	/**
	 * Clears the list of stats
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.clearStats = function(){
		_.forIn(oStats, function(aStats, sType){
			oStats[sType] = [];
		});
	};


	/**
	 * Updates the mini stats view
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.updateStatsView = function(){
		var aStats = [],
			aLangStats,
			aWordStats,
			aRepoStats,
			iTotalWords;

		aLangStats = _.filter(oStats.langs, function(oStat){
			return oStat.value > 0;
		});

		aWordStats = _.filter(oStats.words, function(oStat){
			return oStat.value > 0;
		}).slice(0, 10);

		aRepoStats = _.filter(oStats.repos, function(oStat){
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
				$statsList = $miniStats.find('#top-' + sType),
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
					$statItems = $statsList.find('li.stat-item[data-stat-type="' + sType + '"]'),
					$statItem,
					sStatContent;

				$statItems.each(function(i, el){
					var $el = $(el),
						oData = $el.data();

					if(oData.statLabel !== sLabel){
						return true;
					}

					$statItem = $el;

					return false;
				});

				if($statItem && $statItem.length){
					$statItem
						.removeClass('out-of-range')
						.find('.stat-bar')
						.css({
							width: nPct + '%'
						});

					return true;
				}

				if(!oStat.url.length){
					sStatContent = '<div class="stat-label stat-item-child">' + sLabel + '</div>';
				}else{
					sStatContent = '<a class="stat-link stat-item-child" href="' + oStat.url + '" target="_blank" title="Visit this repository\'s home page"><div class="stat-label">' + sLabel + '</div></a>';
				}

				$statItem = $('<li class="stat-item" data-stat-type="' + oStatsInfo.type + '" data-stat-label="' + sLabel + '"><div class="stat-bar stat-item-child" style="width:' + nPct + '%"></div>' + sStatContent + '</li>');
				
				$statsList.append($statItem);

				$statItem.data({
					statLabel: sLabel
				});
			});
		});
	};


	/**
	 * Updates the last event date text
	 *
	 * @param mixed unixTimestamp - A string/integer UNIX timestamp in seconds (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.updateLastEventDate = function(unixTimestamp){
		var dLastUpdated,	
			aDates = [];

		dLastUpdated = moment(unixTimestamp, 'X');

		if(!dLastUpdated.isValid()){
			aDates = [
				'N/A',
				'N/A'
			];
		}else{
			aDates = [
				dLastUpdated.format('dddd, MMMM D, YYYY'),
				dLastUpdated.format('HH:mm:ss ZZ')
			];
		}

		$lastEventDate
			.find('.event-date-formatted')
			.html(aDates.join('<br>'));
	};


	init();
};



/**
 * Controller for the main stage
 *
 * @author Brad Beebe
 */
Stage = function(){
	var _this = this,
		$stage,
		$actorTpl,
		oDimensions,
		oFlags,
		oTimers;


	/**
	 * Constructor init callback
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function init(){
		var _$actorTpl;

		_this.signal = $({});
		
		oDimensions = {
			stage: {
				width: null,
				height: null
			}
		};

		oFlags = {
			isInspectionMode: false
		};

		oTimers = {
			windowResize: null
		};

		$stage = $('#stage');

		if(!$stage || $stage.length !== 1){
			console.error('Invalid stage');

			return;
		}

		_$actorTpl = $stage.find('#actor-template');

		if(!_$actorTpl || _$actorTpl.length !== 1){
			console.error('Invalid stage actor template');

			return;
		}
		
		$actorTpl = _$actorTpl.removeAttr('id').clone(false);

		$window.on('resize', function(e){
			clearTimeout(oTimers.windowResize);

			oTimers.windowResize = setTimeout(calcDimensions.bind(_this), 500);
		});

		calcDimensions();

		$actorTpl.remove();
	}


	/**
	 * Caclulates and records any DOM element dimensions
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function calcDimensions(){
		_.merge(oDimensions, {
			stage: {
				width: $stage.outerWidth(),
				height: $stage.outerHeight()
			}
		});
	}


	/**
	 * Creates a new actor element
	 *
	 * @return object - jQuery element
	 *
	 * @author Brad Beebe
	 */
	function getNewActor(){
		var $actor;

		$actor = $actorTpl.clone(false);

		$stage.append($actor);

		clearActor($actor);

		return $actor;
	}


	/**
	 * Clears an actor's content
	 * 
	 * @param  object $actor - jQuery element
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	function clearActor($actor){
		$actor
			.data({
				wordEvent: null
			})
			.removeClass('actor-positioned filter-match')
			.find('.actor-inner')
			.removeClass('layer-1 layer-2 layer-2')
			.find('.event-word, .repo-langs, .event-url, .repo-url, .event-date')
			.html('')
			.filter('.event-url, .repo-url')
			.attr('href', '#');
	}


	/**
	 * Prepars an actor for animation
	 * 
	 * @param  object $actor - jQuery element
	 * @return void
	 */
	function prepareActor($actor){
		var zIndex = _.random(1, 10),
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

		$actor
			.css({
				left: _.random(0, (oDimensions.stage.width - $actor.outerWidth())),
				zIndex: zIndex,
				transform: ''
			});
	}


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
	this.addActor = function(oData, oOpts){
		oOpts = oOpts || {};

		var oFilters = oOpts.filters || {},
			aLangFilters = oFilters.langs || [],
			aWordFilters = oFilters.words || [],
			iHeight,
			iLayerIndex,
			iDuration,
			aLangMatchList,
			aRepoLangs,
			aLangDiff,
			bAnyFilterMatch = false,
			$actor;

		if(!oData || !_.isPlainObject(oData) || oFlags.isInspectionMode === true){
			return;
		}

		// Check for language matches
		if(aLangFilters.length > 0){
			aRepoLangs = _.map(oData.repo.langs, function(sLang){
				return sLang.toLowerCase();
			});

			aLangDiff = _.difference(aRepoLangs, aLangFilters);

			bAnyFilterMatch = aLangDiff.length !== aRepoLangs.length;
		}

		// Check for word matches (if not already matched a language)
		if(aWordFilters.length > 0 && bAnyFilterMatch === false){
			bAnyFilterMatch = _.indexOf(aWordFilters, oData.word.toLowerCase()) !== -1;
		}

		$actor = getNewActor();

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

		$actor
			.find('.event-date')
			.html(moment(oData.timestamp, 'X').format('dddd, MMMM D, YYYY @ HH:mm:ss ZZ'));

		if(bAnyFilterMatch){
			$actor.addClass('filter-match');
		}

		prepareActor($actor);

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
				translateY: [(oDimensions.stage.height + (iHeight * 2)), -iHeight]
			},{
				complete: function(){
					$actor.addClass('mark-for-gc');

					// While we prevent new actors from increased the mini stats
					// we want freed actors to propertly reflect their departure
					// from the stage
					_this.signal.trigger('Actor:Freed', {
						actorData: oData,
						isFilterMatch: false
					});
				},
				duration: iDuration,
				easing: 'linear'
			});

		this.signal.trigger('Actor:Added', {
			actorData: oData,
			isFilterMatch: $actor.hasClass('filter-match')
		});
	};


	/**
	 * Iterates through any active actors and filters them out based
	 * on words and/or languages
	 * 
	 * @param  object oFilters (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.filterActors = function(oFilters){
		oFilters = oFilters || {};

		var aRepoLangs,
			aLangMatchList = oFilters.langs || [],
			aWordMatchList = oFilters.words || [],
			iNumLangMatchList = aLangMatchList.length,
			iNumWordsMatchList = aWordMatchList.length;

		$stage.find('.actor:not(.mark-for-gc)').each(function(i, el){
			var $el = $(el),
				oWordEvent = $el.data('wordEvent'),
				aLangDiff,
				bMatchesLangFilter = false,
				bMatchesWordFilter = false;

			if(!_.isPlainObject(oWordEvent)){
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
	};


	/**
	 * Toggles inspection mode of the stage's current active actors
	 * 
	 * @param  boolean bEnable
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.toggleInspectionMode = function(bEnable){
		var $actors;

		switch(bEnable){
			default:
				return;

			case true:
				$actors = $stage
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

				$actors.detach().appendTo($stage);

				this.gc();

				$('body').addClass('inspection-mode');

				break;

			case false:
				this.empty();

				$('body').removeClass('inspection-mode');

				break;
		}

		oFlags.isInspectionMode = bEnable;
	};


	/**
	 * Empties the stage's actors
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.empty = function(){
		$stage
			.find('.actor')
			.velocity('stop')
			.remove();
	};


	/**
	 * Clears out any actors marked for garbage collection
	 * 
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	this.gc = function(){
		$stage
			.find('.actor.mark-for-gc')
			.remove();
	};


	/**
	 * Determines if inspection mode is currently active
	 * 
	 * @return boolean
	 *
	 * @author Brad Beebe
	 */
	this.isInspectionModeActive = function(){
		return oFlags.isInspectionMode;
	};


	init();
};

})(jQuery);