/*jshint node:true */
/*global describe, it, before, beforeEach, after, afterEach */
var expect = require('chai').expect;
var RedisScript = require('../index');
var _ = require('lodash');
var fs = require('fs');

describe('Redis Lua Script Manager', function() {
  var rs = new RedisScript();
  describe('Add', function() {
    it('should add new lua script file', function() {
      rs.add('fetch', './lua_script.lua');
      expect(rs.__scripts).to.deep.equal({
        fetch: {
          filename: './lua_script.lua'
        }
      });
      rs.__scripts = {};
    });
    it('should add new lua script', function() {
      rs.add('keys', 'return redis.call("KEYS")');
      expect(rs.__scripts).to.deep.equal({
        keys: {
          script: 'return redis.call("KEYS")'
        }
      });
      rs.__scripts = {};
    });
    it('should add all lua script files inside a directory', function() {
      fs.mkdirSync('./test/lua');
      _.times(3, function(index) {
        fs.closeSync(fs.openSync('./test/lua/script'+index+'.lua', 'w'));
      });
      rs.add('./test/lua');
      expect(rs.__scripts).to.deep.equal({
        script0: {
          filename: './test/lua/script0.lua'
        },
        script1: {
          filename: './test/lua/script1.lua'
        },
        script2: {
          filename: './test/lua/script2.lua'
        }
      });
      _.times(3, function(index) {
        fs.unlinkSync('./test/lua/script'+index+'.lua');
      });
      fs.rmdirSync('./test/lua');
    });
  });

  describe('Execute', function() {
    var script = 'local keys = redis.call("KEYS", ARGV[1] .. "*");'+
      'return redis.call("MGET", unpack(keys))';
    it('should load and execute new lua script', function(done) {
      rs.__scripts = {};
      rs.__conn.mset('key0', 'val0', 'key1', 'val1', function(err) {
        if(err) return done(err);
        rs.add('valwithstartkey',script);
        rs.exec('valwithstartkey', 'key', function(err, results) {
          if(err) return done(err);
          expect(_.intersection(results, ['val0', 'val1']).length).to.equal(2);
          expect(rs.__scripts.valwithstartkey.sha1).to.be.a.string;//jshint ignore:line
          done();
        });
      });
    });
    it('should load and execute new lua script file', function(done) {
      rs.__scripts = {};
      fs.writeFileSync('./test/valwithstartkey.lua', script);
      rs.add('./test');
      rs.exec('valwithstartkey', 'key', function(err, results) {
        if(err) return done(err);
        expect(_.intersection(results, ['val0', 'val1']).length).to.equal(2);
        expect(rs.__scripts.valwithstartkey.sha1).to.be.a.string;//jshint ignore:line
        done();
      });
    });
    it('should execute already loaded lua script', function(done) {
      var sha1 = rs.__scripts.valwithstartkey.sha1;
      rs.exec('valwithstartkey', 'key', function(err, results) {
        if(err) return done(err);
        expect(_.intersection(results, ['val0', 'val1']).length).to.equal(2);
        expect(rs.__scripts.valwithstartkey.sha1).to.equal(sha1);
        done();
      });
    });
    it('should load and execute lua script after script cache is flushed', function(done) {
      rs.__conn.script('flush', function(err) {
        if(err) return done(err);
        rs.exec('valwithstartkey', 'key', function(err, results) {
          if(err) return done(err);
          expect(_.intersection(results, ['val0', 'val1']).length).to.equal(2);
          expect(rs.__scripts.valwithstartkey.sha1).to.be.a.string;//jshint ignore:line
          fs.unlinkSync('./test/valwithstartkey.lua');
          done();
        });
      });
    });
  });
});
