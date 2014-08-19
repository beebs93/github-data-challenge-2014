var path = require('path'),
	sAppDir = path.dirname(require.main.filename),
	_ = require('lodash'),
	oauth,
	config;


// Base config class
function Config(){
	_.merge(this, {
		api: {
			limits: {
				minWordLength: 3,
				maxWordLength: 20
			}
		},
		db: {
			redis: {
				dbIndex: null
			}
		},
		general: {
			defaults: {
				iterationIntervalMS: 30000
			}
		},
		github: {
			defaults: {
				maxReqsPerHour: 5000,
				reqTimeoutMS: 10000
			},
			ttl: {
				repoSEC: null,
				wordSEC: null
			},
			uris: {
				api: {
					base: 'https://api.github.com',
					events: '/events',
					languages: '/languages'
				}
			}
		},
		servers: {
			http: {
				port: null
			},
			socketio: {
				port: null
			}
		}
	});
};


// Default/fallback config settings
function DefaultConfig(){
	_.merge(this, {
		db: {
			redis: {
				dbIndex: 1
			}
		},
		github: {
			ttl: {
				repoSEC: 3600,
				wordSEC: 30
			}
		},
		servers: {
			http: {
				port: 3000
			},
			socketio: {
				port: 3010
			}
		}
	});
};

DefaultConfig.prototype = new Config();


// Load the config file based on current Node environment
switch(process.env.NODE_ENV){
	default:
		process.env.NODE_ENV = 'default';

		config = new DefaultConfig();

		break;
};

try{
	oauth = require(sAppDir + '/oauth.json');
}
catch(err){
	console.error('**********************\n"' + sAppDir + '/oauth.json" file not found.\nPlease review the README.md file for installation instructions.\n**********************');

	process.exit();
}

_.merge(config, oauth[process.env.NODE_ENV]);

module.exports = config;