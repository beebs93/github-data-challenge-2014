var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug'),
	harvester = require(sAppDir + '/server/libraries/github-event-harvester');

module.exports = {
	harvest: {
		/**
		 * Starts the GitHub Event Harvester
		 * 
		 * @return void
		 *
		 * @author Brad Beebe
		 */
		start: function(){
			debug.info('Starting harvest of GitHub events');
			
			harvester.start();
		},


		/**
		 * Stops the GitHub Event Harvester
		 * 
		 * @return void
		 *
		 * @author Brad Beebe
		 */
		stop: function(){
			debug.info('Stopping harvest of GitHub events');

			harvester.stop();
		}
	}
};