module.exports = {
	outputMessages: true,


	/**
	 * Logs an error message
	 * 
	 * @param  mixed msg - Log message
	 * @param  string sNamespace - Message namespace (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	error: function(msg, sNamespace){
		this.logMessage(msg, 'error', sNamespace);
	},
	

	/**
	 * Logs an info message
	 * 
	 * @param  mixed msg - Log message
	 * @param  string sNamespace - Message namespace (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	info: function(msg, sNamespace){
		this.logMessage(msg, 'info', sNamespace);
	},
	

	/**
	 * Logs a standard log message
	 * 
	 * @param  mixed msg - Log message
	 * @param  string sNamespace - Message namespace (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	log: function(msg, sNamespace){
		this.logMessage(msg, 'log', sNamespace);
	},

	
	/**
	 * Logs a warning message
	 * 
	 * @param  mixed msg - Log message
	 * @param  string sNamespace - Message namespace (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	warn: function(msg, sNamespace){
		this.logMessage(msg, 'warn', sNamespace);
	},
	

	/**
	 * Logs a message to the console
	 * 
	 * @param  mixed msg - Log message
	 * @param  string sType - Type of console message
	 * @param  string sNamespace - Message namespace (optional)
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	logMessage: function(msg, sType, sNamespace){
		var moment = require('moment-timezone'),
			sPrefix;

		if(this.outputMessages !== true){
			return;
		}

		if(typeof console[sType] !== 'function'){
			sType = 'log';
		}

		if(typeof sNamespace !== 'string'){
			sNamespace = 'general';
		}

		sPrefix = moment().tz('America/Vancouver').format('YYYY-MMM-DD HH:mm:ss Z');
		sPrefix += ' [' + sType.toUpperCase() + '][' + sNamespace.toUpperCase() + '] ';

		console[sType](' ');
		
		if(typeof msg === 'string'){
			console[sType](sPrefix + msg);
		}else{
			console[sType](sPrefix);
			console[sType](msg);
		}
	}
};