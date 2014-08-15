var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	_ = require('lodash'),
	config = require(sAppDir + '/server/system/config'),
	debug = require(sAppDir + '/server/system/debug');

module.exports = {
	/**
	 * Error 404
	 * 
	 * @param  object req - ExpressJS HTTP request
	 * @param  object res - ExpressJS HTTP response
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	err404: function(req, res){
		res.status(404);

		if(req.accepts('html')){
			res.render('404.html');
			
			return;
		}

		if(req.accepts('json')){
			res.send({
				status: 'Not found'
			});
			
			return;
		}

		res.type('txt');
		res.send('Error 404');
	},


	/**
	 * Home page
	 * 
	 * @param  object req - ExpressJS HTTP request
	 * @param  object res - ExpressJS HTTP response
	 * @return void
	 *
	 * @author Brad Beebe
	 */
	home: function(req, res){
		res.render('home');
	}
};