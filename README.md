GitHub 2014 Data Challenge
=========

Entry for the [Third Annual GitHub Data Challenge](https://github.com/blog/1864-third-annual-github-data-challenge)

Requirements
--------------
- `node.js v.0.10.28+`
- `Redis Server v.2.6.14+`

Installation
--------------

```sh
git clone git@github.com:beebs93/github-data-challenge-2014.git github-data-challenge-2014-brad-beebe
cd github-data-challenge-2014-brad-beebe
npm install
```

Get Started (Local Environment)
--------------

- Register a new [GitHub OAuth application](https://github.com/settings/applications/new)

- Make a copy of the `oauth.template.json` file and save it as `oauth.json`

- Open the `oauth.json` file then replace the default `"clientId"` and `"clientSecret"` with the ones from your app

- Install the Redis Server module (if not already done so)

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

- Load [http://127.0.0.1:3000](http://127.0.0.1:3000) in any browser
