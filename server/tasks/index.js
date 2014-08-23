'use strict';

var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	debug = require(sAppDir + '/server/system/debug'),
	harvester = require(sAppDir + '/server/libraries/github-event-harvester');

module.exports = {
	_status: 'stopped',



	harvest: {
		/**
		 * Starts the GitHub Event Harvester
		 * 
		 * @return void
		 *
		 * @author Brad Beebe
		 */
		start: function(){
			if(harvester.getStatus() !== 'stopped'){
				return;
			}

			debug.info('Starting harvest of GitHub events');
			
			harvester.start();
		},


		/**
		 * Resumes the GitHub Event Harvester
		 * 
		 * @return void
		 *
		 * @author Brad Beebe
		 */
		resume: function(){
			if(harvester.getStatus() !== 'paused'){
				return;
			}

			debug.info('Resuming harvest of GitHub events');
			
			harvester.resume();
		},


		/**
		 * Stops the GitHub Event Harvester
		 * 
		 * @return void
		 *
		 * @author Brad Beebe
		 */
		stop: function(){
			if(harvester.getStatus() !== 'started'){
				return;
			}

			debug.info('Stopping harvest of GitHub events');

			harvester.stop();
		}
	}
};