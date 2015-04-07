# redis-script
A redis lua script manager with the following features:
+ minimalist api
+ lua script caching
+ automatic reloading of corrupted or deleted script cache

[![Build Status](https://travis-ci.org/rogermadjos/redis-script.svg)](https://travis-ci.org/rogermadjos/redis-script)
[![npm version](https://badge.fury.io/js/redis-script.svg)](http://badge.fury.io/js/redis-script)

## How to install

```
npm install redis-script --save
```

## How to use
```js
var RedisScript = require('redis-script');

//creates a redis connection at port 6379 of `127.0.0.1`
var rs = new RedisScript();

//accepts a redis connection
var rs = new RedisScript(conn);

//add a lua script file
rs.add('name', './lua/filename.lua');

//add a lua script
rs.add('name', 'local keys = redis.call("KEYS", ARGV[1] .. "*");'+
  'return redis.call("MGET", unpack(keys))');

//add all lua script files inside a directory
rs.add('./lua');

//load and execute lua scripts
rs.exec('name', callback);
rs.exec('name', ['key0', 'key1', ..], callback);
rs.exec('name', ['key0', 'key1', ..], ['argv0', 'argv1', ..], callback);
rs.exec('name', 'argv', callback);
rs.exec('name', 'argv0', 'argv1', .. , callback);

```

## License

MIT
