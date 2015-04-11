/*jshint node:true */

var redis = require('redis');
var _ = require('lodash');
var fs = require('fs');
var debug = require('debug')('redis-script');
var error = require('debug')('redis-script:error');

function RedisScript(conn) {
  this.__scripts = {};
  this.__conn = conn || redis.createClient(6379, '127.0.0.1');
}

RedisScript.prototype.add = function() {
  var self = this;
  if(arguments.length < 1) throw new Error('Invalid number of arguments');
  if(arguments.length >= 2) {
    if(!_.isString(arguments[0])) throw new Error('Invalid argument. `name` is not of type `string`');
    if(!_.isString(arguments[1])) throw new Error('Invalid argument. `script` is not of type `string`');
    var name = arguments[0];
    if(_.endsWith(arguments[1], '.lua')) {
      this.__scripts[name] = {
        filename: arguments[1]
      };
    }
    else {
      if(!_.isString(arguments[0])) throw new Error('Invalid argument. `directory` is not of type `string`');
      this.__scripts[name] = {
        script: arguments[1]
      };
    }
    debug('added: %s %o', name, arguments[1]);
  }
  else if(arguments.length === 1) {
    var directory = arguments[0];
    var filenames = _.filter(fs.readdirSync(directory),function(filename) {
      return _.endsWith(filename, '.lua');
    });
    _.each(filenames, function(filename) {
      var name = filename.split('.')[0];
      self.add(name, directory+'/'+filename);
    });
  }
};

RedisScript.prototype.exec = function() {
  var self = this;
  if(arguments.length < 2) throw new Error('Invalid number of arguments');
  var argu = Array.prototype.slice.call(arguments);
  var name = argu.shift();
  if(!_.isString(name)) throw new Error('Invalid argument. `name` is not of type `string`');
  var callback = argu.pop();
  if(!_.isFunction(callback)) throw new Error('Invalid argument. `callback` is not of type `function`');
  var keys = [], args = [];
  if(argu.length > 0) {
    if(_.isArray(argu[0])) {
      keys = argu.shift();
    }
  }
  if(argu.length === 1 && _.isArray(argu[0])) {
    args = argu.shift();
    args = _.map(args, function(arg) {
      return arg+'';
    });
  }
  if(argu.length > 0) {
    _.each(argu, function(arg, index) {
      args.push(arg+'');
    });
  }
  if(!self.__scripts[name]) throw new Error('No script: '+name);
  if(self.__scripts[name].sha1) {
    var arr = [self.__scripts[name].sha1, keys.length];
    arr = arr.concat(keys);
    arr = arr.concat(args);
    self.__conn.evalsha(arr, function(err, result) {
      if(err) {
        error(err);
        if(_.contains(err.toString(), 'NOSCRIPT')) {
          debug('retry: %s', name);
          delete self.__scripts[name].sha1;
          self.exec(name, keys, args, callback);
        }
        else {
          callback(err);
        }
      }
      else {
        debug('exec: %s %o', name, result);
        callback(null, result);
      }
    });
  }
  else {
    var load = function(script) {
      self.__conn.script('load', script, function(err, sha1) {
        if(err) {
          error(err);
          return callback(err);
        }
        debug('loaded: %s %o', name, sha1);
        self.__scripts[name].sha1 = sha1;
        self.exec(name, keys, args, callback);
      });
    };
    if(self.__scripts[name].filename) {
      fs.readFile(self.__scripts[name].filename, 'utf8', function(err, data) {
        if(err) {
          error(err);
          return callback(err);
        }
        debug('file: %s %o', name, data);
        load(data);
      });
    }
    else {
      load(self.__scripts[name].script);
    }
  }
};

module.exports = RedisScript;
