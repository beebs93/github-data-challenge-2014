GitHub 2014 Data Challenge
=========

Entry for the [Third Annual GitHub Data Challenge](https://github.com/blog/1864-third-annual-github-data-challenge)

Description
--------------
An application that represents specific user-generated messages retrieved from the public [GitHub Events API](https://developer.github.com/v3/activity/events/) broken down by word and the programming language(s) of the originating GitHub repository.

Requirements
--------------
- `git v1.8.5.2+`
- `node.js v0.10.28+`
- `Redis Server v2.6.14+`
- `Grunt CLI v0.1.13+`

Installation
--------------
- [Download and install git](http://git-scm.com/downloads)

- [Download and install node.js](http://nodejs.org/download/)

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

- Install the `redis-server` npm module globally

```sh
npm install -g redis-server
```

- Open a new Terminal window and start the Redis server

```sh
redis-server
```

- Navigate to the directory where you cloned the repo in the previous Terminal window and start the node server

```sh
node index.js
```

- Load [http://127.0.0.1:3000](http://127.0.0.1:3000) in the latest version of any browser

License
--------------
Copyright (c) 2014 Brad Beebe

Dual-licensed under MIT and GPL licenses.
