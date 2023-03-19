'use strict';

var fs = require('graceful-fs');
var File = require('vinyl');
var expect = require('expect');
var sinon = require('sinon');
var stream = require('stream');
var concat = require('concat-stream');

// TODO: This `from` should be replaced to `node:stream.Readable.from`
// if this package supports only >= v10.17.0
var from = require('streamx').Readable.from;

var vfs = require('../');

var cleanup = require('./utils/cleanup');
var isWindows = require('./utils/is-windows');
var testConstants = require('./utils/test-constants');

var pipeline = stream.pipeline;

var inputBase = testConstants.inputBase;
var outputBase = testConstants.outputBase;
var inputPath = testConstants.inputPath;
var outputPath = testConstants.outputPath;
var contents = testConstants.contents;

var clean = cleanup(outputBase);

describe('.dest() with custom times', function() {

  beforeEach(clean);
  afterEach(clean);

  it('does not call futimes when no mtime is provided on the vinyl stat', function(done) {
    // Changing the time of a directory errors in Windows.
    // Windows is treated as though it does not have permission to make this operation.
    if (isWindows) {
      this.skip();
      return;
    }

    var earlier = Date.now() - 1001;

    var futimesSpy = sinon.spy(fs, 'futimes');

    var file = new File({
      base: inputBase,
      path: inputPath,
      contents: Buffer.from(contents),
      stat: {},
    });

    function assert() {
      var stats = fs.lstatSync(outputPath);

      expect(futimesSpy.callCount).toEqual(0);
      expect(stats.atime.getTime()).toBeGreaterThan(earlier);
      expect(stats.mtime.getTime()).toBeGreaterThan(earlier);
    }

    pipeline([
      from([file]),
      vfs.dest(outputBase, { cwd: __dirname }),
      concat(assert),
    ], done);
  });

  it('calls futimes when an mtime is provided on the vinyl stat', function(done) {
    if (isWindows) {
      this.skip();
      return;
    }

    // Use new mtime
    var mtime = new Date(Date.now() - 2048);

    var futimesSpy = sinon.spy(fs, 'futimes');

    var file = new File({
      base: inputBase,
      path: inputPath,
      contents: Buffer.from(contents),
      stat: {
        mtime: mtime,
      },
    });

    function assert() {
      expect(futimesSpy.callCount).toEqual(1);

      // Compare args instead of fs.lstats(), since mtime may be drifted in x86 Node.js
      var mtimeSpy = futimesSpy.getCall(0).args[2];

      expect(mtimeSpy.getTime())
        .toEqual(mtime.getTime());

      expect(file.stat.mtime).toEqual(mtime);
    }

    pipeline([
      from([file]),
      vfs.dest(outputBase, { cwd: __dirname }),
      concat(assert),
    ], done);
  });

  it('does not call futimes when provided mtime on the vinyl stat is invalid', function(done) {
    if (isWindows) {
      this.skip();
      return;
    }

    var earlier = Date.now() - 1001;

    var futimesSpy = sinon.spy(fs, 'futimes');

    var file = new File({
      base: inputBase,
      path: inputPath,
      contents: Buffer.from(contents),
      stat: {
        mtime: new Date(undefined),
      },
    });

    function assert() {
      var stats = fs.lstatSync(outputPath);

      expect(futimesSpy.callCount).toEqual(0);
      expect(stats.mtime.getTime()).toBeGreaterThan(earlier);
    }

    pipeline([
      from([file]),
      vfs.dest(outputBase, { cwd: __dirname }),
      concat(assert),
    ], done);
  });

  it('calls futimes when provided mtime on the vinyl stat is valid but provided atime is invalid', function(done) {
    if (isWindows) {
      this.skip();
      return;
    }

    // Use new mtime
    var mtime = new Date(Date.now() - 2048);
    var invalidAtime = new Date(undefined);

    var futimesSpy = sinon.spy(fs, 'futimes');

    var file = new File({
      base: inputBase,
      path: inputPath,
      contents: Buffer.from(contents),
      stat: {
        atime: invalidAtime,
        mtime: mtime,
      },
    });

    function assert() {
      expect(futimesSpy.callCount).toEqual(1);

      var mtimeSpy = futimesSpy.getCall(0).args[2];

      expect(mtimeSpy.getTime()).toEqual(mtime.getTime());
    }

    pipeline([
      from([file]),
      vfs.dest(outputBase, { cwd: __dirname }),
      concat(assert),
    ], done);
  });

  it('writes file atime and mtime using the vinyl stat', function(done) {
    if (isWindows) {
      this.skip();
      return;
    }

    // Use new atime/mtime
    var atime = new Date(Date.now() - 2048);
    var mtime = new Date(Date.now() - 1024);

    var futimesSpy = sinon.spy(fs, 'futimes');

    var file = new File({
      base: inputBase,
      path: inputPath,
      contents: Buffer.from(contents),
      stat: {
        atime: atime,
        mtime: mtime,
      },
    });

    function assert() {
      expect(futimesSpy.callCount).toEqual(1);

      var atimeSpy = futimesSpy.getCall(0).args[1];
      var mtimeSpy = futimesSpy.getCall(0).args[2];

      expect(atimeSpy.getTime()).toEqual(atime.getTime());
      expect(mtimeSpy.getTime()).toEqual(mtime.getTime());
      expect(file.stat.mtime).toEqual(mtime);
      expect(file.stat.atime).toEqual(atime);
    };

    pipeline([
      from([file]),
      vfs.dest(outputBase, { cwd: __dirname }),
      concat(assert),
    ], done);
  });
});
