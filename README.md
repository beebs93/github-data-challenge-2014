GitHub 2014 Data Challenge
=========

Entry for the [Third Annual GitHub Data Challenge](https://github.com/blog/1864-third-annual-github-data-challenge)

Description
--------------
An application that represents real-time user-generated messages retrieved from the public [GitHub Events API](https://developer.github.com/v3/activity/events/) broken down by word and the programming language(s) of its originating GitHub repository.

![](https://raw.githubusercontent.com/beebs93/github-data-challenge-2014/master/client/public/img/screenshots/g-entry-1.jpg)

Requirements
--------------
- `git v1.8.5.2+`
- `node.js v0.10.28+`
- `Redis v2.6.14+`
- `Grunt CLI v0.1.13+`

Installation
--------------
- [Download and install git](http://git-scm.com/downloads)

- [Download and install node.js](http://nodejs.org/download/)

- [Download and install Redis](http://redis.io/download)

- Install the `grunt-cli` npm module globally

```sh
npm install -g grunt-cli
```

- Clone this repository, install any of its dependencies and run the default `grunt` task

```sh
git clone git@github.com:beebs93/github-data-challenge-2014.git github-data-challenge-2014-brad-beebe
cd github-data-challenge-2014-brad-beebe
npm install
grunt
```

Get Started (Local Environment)
--------------

- Register a new [GitHub OAuth application](https://github.com/settings/applications/new)

- Make a copy of the `oauth.template.json` file and save it as `oauth.json`

- Open the `oauth.json` file then replace `"ENTER_YOUR_CLIENT_ID"` and `"ENTER_YOUR_CLIENT_SECRET"` with the ones from your GitHub OAuth application

- Open a new Terminal window and start the Redis server

```sh
redis-server
```

- Navigate to the directory where you cloned the repo in the previous Terminal window and start the node server

```sh
node index.js
```

- Load [http://127.0.0.1:3000](http://127.0.0.1:3000) in the latest version of any browser

Configuration
--------------
The main `Config` class located in `server/system/config.js` contains the base application settings.

Each environment (based on the current `process.env.NODE_ENV` variable) extends this class and can overwrite whatever base options with their own.

- Create a new child `Config` class
```javascript
function FooConfig(){
	_.merge(this, {
		db: {
			redis: {
				dbIndex: 10,
				host: 'another-endpoint.cache.amazonaws.com'
			}
		},
		servers: {
			http: {
				port: 9000
			},
			socketio: {
				port: 9020
			}
		}
	});
}

FooConfig.prototype = new Config();
```
- Add the new environment to the existing `switch` statement at the bottom
```javascript
switch(process.env.NODE_ENV){
	default:
		process.env.NODE_ENV = 'default';

		config = new DefaultConfig();

		break;
	
	case 'foo':
		config = new FooConfig();
		
		break;
}
```
- Add the new environment's OAuth credientials to your `oauth.json` file
```json
{
	"default": {
		"github": {
			"oauth": {
				"clientId": "123abc456def",
				"clientSecret": "fed654cba321"
			}
		}
	},
	"foo": {
		"github": {
			"oauth": {
				"clientId": "789ghi101112jkl",
				"clientSecret": "lkj211101ihg987"
			}
		}
	}
}
```

License
--------------
Copyright (c) 2014 Brad Beebe

Dual-licensed under MIT and GPL licenses.
