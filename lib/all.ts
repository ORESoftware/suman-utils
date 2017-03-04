'use strict';

process.on('warning', function (w: any) {
  console.error('\n', ' => Suman warning => ', (w.stack || w), '\n');
});


//core
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as assert from 'assert';

//npm
const async = require('async');
const residence = require('residence');
const _ = require('lodash');
const debug = require('suman-debug')('s:utils');
const mkdirp = require('mkdirp');

//project
import * as dts from '../d.ts/global';
const isX = require('./is-x');
const toStr = Object.prototype.toString;
const fnToStr = Function.prototype.toString;
const isFnRegex = /^\s*(?:function)?\*/;
const runTranspile = require('./run-transpile');

/////////////////////////////////////////////////////////////////////////////////////

interface MapToTargetDirResult {
  originalPath: string,
  targetPath: string
}

let globalProjectRoot : string = null;

const sumanUtils = module.exports = {

  isStream: isX.isStream,
  isObservable: isX.isObservable,
  isSubscriber: isX.isSubscriber,
  runTranspile: runTranspile,

  mapToTargetDir: function (item: string): MapToTargetDirResult {

    const projectRoot = process.env.SUMAN_PROJECT_ROOT;

    // note => these values were originally assigned in suman/index.js,
    // were then passed to suman server, which then required this file
    const testDir = process.env.TEST_DIR;
    const testSrcDir = process.env.TEST_SRC_DIR;
    const testTargetDir = process.env.TEST_TARGET_DIR;
    const testTargetDirLength = String(testTargetDir).split(path.sep).length;

    item = path.resolve(path.isAbsolute(item) ? item : (projectRoot + '/' + item));

    var itemSplit = String(item).split(path.sep);
    itemSplit = itemSplit.filter(i => i); // get rid of pesky ['', first element

    debug('itemSplit:', itemSplit);

    const originalLength = itemSplit.length;
    const paths = sumanUtils.removeSharedRootPath([projectRoot, item]);
    const temp = paths[1][1];

    debug(' => originalLength:', originalLength);
    debug(' => testTargetDirLength:', testTargetDirLength);
    debug(' => temp path:', temp);

    var splitted = temp.split(path.sep);
    splitted = splitted.filter(i => i); // get rid of pesky ['', first element

    debug('splitted before shift:', splitted);

    while ((splitted.length + testTargetDirLength) > originalLength + 1) {
      splitted.shift();
    }

    debug('splitted after shift:', splitted);

    const joined = splitted.join(path.sep);

    debug('pre-resolved:', joined);
    debug('joined:', joined);

    return {
      originalPath: item,
      targetPath: path.resolve(testTargetDir + '/' + joined)
    }
  },

  isSumanDebug: function () : boolean {
    return process.env.SUMAN_DEBUG === 'yes';
  },


  runAssertionToCheckForSerialization: function (val: Object): void {
    if (!val) {
      return;
    }
    assert(['string', 'boolean', 'number'].indexOf(typeof val) >= 0,
      ' => Suman usage error => You must serialize data called back from suman.once.pre.js value functions, ' +
      'here is the data in raw form =>\n' + val + ' and here we have run util.inspect on it =>\n' + util.inspect(val));
  },

  buildDirsWithMkDirp: function (paths : Array<string>, cb: Function) : void {
    async.each(paths, function (p: string, cb: Function) {
      mkdirp(p, cb);
    }, cb);
  },

  getArrayOfDirsToBuild: function (testTargetPath: string, p: string): string | undefined {

    // => p is expected to be a path to a file, not a directory

    var temp: any = null;
    const l = path.normalize('/' + testTargetPath).split('/').length;
    const items = path.normalize('/' + p).split('/');

    debug(' => length of testTargetPath:', l);
    debug(' => items length:', items.length);

    if (fs.statSync(p).isFile()) {
      items.pop(); // always get rid of the first file
    }

    if (items.length >= l) {
      temp = path.normalize(items.slice(l).join('/'));
    }
    else {
      console.log('\n');
      console.error(' => Suman-Utils warning => path to file was not longer than path to test-target dir.');
      console.error(' => Suman-Utils warning => path to file =>', p);
      console.error(' => Suman-Utils warning => testTargetDir =>', testTargetPath);
      console.log('\n');
    }

    if (temp) {
      return path.resolve(testTargetPath + '/' + temp);
    }

    // return undefined otherwise :)

  },

  checkIfPathAlreadyExistsInList: function (paths: Array<string>, p: string, index: number) : boolean{

    // assume paths =>  [/a/b/c/d/e]
    // p => /a/b/c
    // this fn should return true then

    return paths.some(function (pth, i) {
      if(i === index){
        // we ignore the matching item
        return false;
      }
      return String(pth).indexOf(p) === 0;
    });

  },

  buildDirs: function (dirs: Array<string>, cb: Function) : void {

    if(dirs.length < 1){
      return process.nextTick(cb);
    }

    async.eachSeries(dirs, function (item: string, cb: Function): void {

      fs.mkdir(item, function (err: Error) {
        if (err && !String(err.stack).match(/eexist/i)) {
          console.error(err.stack || err);
          cb(err);
        }
        else {
          cb(null);
        }
      });

    }, cb);

  },

  padWithFourSpaces: function () : string{
    return new Array(5).join(' ');  //yields 4 whitespace chars
  },

  padWithXSpaces: function (x: number): string {
    return new Array(x + 1).join(' ');  //yields x whitespace chars
  },

  removePath: function (p1: string, p2: string) : string {

    assert(path.isAbsolute(p1) && path.isAbsolute(p2), 'Please pass in absolute paths, ' +
      'p1 => ' + util.inspect(p1) + ', p2 => ' + util.inspect(p2));

    const split1 = String(p1).split(path.sep);
    const split2 = String(p2).split(path.sep);

    const newPath : Array<string> = [];

    const max = Math.max(split1.length, split2.length);

    for (var i = 0; i < max; i++) {
      if (split1[i] !== split2[i]) {
        newPath.push(split1[i]);
      }
    }

    return newPath.join(path.sep);

  },

  findSharedPath: function (p1: string, p2: string) : string {

    const split1 = String(p1).split(path.sep);
    const split2 = String(p2).split(path.sep);

    //remove weird empty strings ''
    const one = split1.filter(i => i);
    const two = split2.filter(i => i);

    const max = Math.max(one.length, two.length);

    // if (split1[0] === '') {
    //     split1.shift();
    // }
    //
    // if (split2[0] === '') {
    //     split2.shift();
    // }

    let i = 0;
    let shared : Array<string> = [];

    while (one[i] === two[i] && i < max) {
      shared.push(one[i]);
      i++;
      if (i > 100) {
        throw new Error(' => Suman implementation error => first array => ' + one + ', ' +
            'second array => ' + two);
      }
    }

    shared = shared.filter(i => i);
    return path.resolve(path.sep + shared.join(path.sep));
  },

  removeSharedRootPath: function (paths: Array<string>): Array<Array<string>> {

    if (paths.length < 2) {   //  paths = ['just/a/single/path/so/letsreturnit']
      return paths.map(function (p) {
        return [p, path.basename(p)];
      });
    }

    let shared : string | Array<string> = null;

    paths.forEach(function (p) {

      //assume paths are absolute before being passed here
      p = path.normalize(p);

      if (shared) {
        const arr = String(p).split('');

        let i = 0;

        arr.every(function (item, index) {
          if (String(item) !== String(shared[index])) {
            i = index;
            return false;
          }
          return true;
        });

        shared = shared.slice(0, i);

      }
      else {
        shared = String(p).split('');
      }

    });

    return paths.map(function (p) {
      const basenameLngth = path.basename(p).length;
      return [p, p.substring(Math.min(shared.length, (p.length - basenameLngth)), p.length)];
    });

  },

  checkForValInStr: function (str: string, regex: RegExp, count: number): boolean {
    //used primarily to check if 'done' literal is in fn.toString()
    return ((String(str).match(regex) || []).length > (count === 0 ? 0 : (count || 1)));
  },

  isGeneratorFn2: function (fn: Function) : boolean {
    const str = String(fn);
    const indexOfFirstParen = str.indexOf('(');
    const indexOfFirstStar = str.indexOf('*');
    return indexOfFirstStar < indexOfFirstParen;
  },

  isGeneratorFn: function (fn: Function) : boolean {

    if (typeof fn !== 'function') {
      return false;
    }
    let fnStr = toStr.call(fn);
    return ((fnStr === '[object Function]' || fnStr === '[object GeneratorFunction]') && isFnRegex.test(fnToStr.call(fn))
    || (fn.constructor.name === 'GeneratorFunction' || fn.constructor.displayName === 'GeneratorFunction'));

  },

  isArrowFunction: function (fn: Function) : boolean {
    //TODO this will not work for async functions!
    return String(fn).indexOf('function') !== 0;
  },

  isAsyncFn: function (fn: Function) : boolean {
    return String(fn).indexOf('async ') === 0;
  },


  defaultSumanHomeDir: function () : string {
    return path.normalize(path.resolve((process.env.HOME || process.env.USERPROFILE) + path.sep + 'suman_data'));
  },

  defaultSumanResultsDir: function () : string {
    return path.normalize(path.resolve(this.getHomeDir() + path.sep + 'suman' + path.sep + 'test_results'));
  },

  getHomeDir: function () : string {
    return process.env[(process.platform === 'win32' ? 'USERPROFILE' : 'HOME')];
  },

  findProjectRoot: function findProjRoot (p : string) : string {
    if (!globalProjectRoot) {
      globalProjectRoot = residence.findProjectRoot(p);
    }
    return globalProjectRoot;
  },

  once: function sumanOnce (ctx: Object, fn: Function) : Function {

    let callable = true;

    return function callOnce (err: Error) {
      if (callable) {
        callable = false;
        return fn.apply(ctx, arguments);
      }
      else {
        console.log(' => Suman warning => function was called more than once -' + fn ? fn.toString() : '');
        if (err) {
          console.error(' => Suman warning => \n', err.stack || util.inspect(err));
        }
      }
    }
  },

  onceAsync: function sumanOnce (ctx: Object, fn: Function) : Function {

    var callable = true;
    return function callOnce (err: Error) {
      const args = arguments;
      if (callable) {
        callable = false;
        process.nextTick(function () {
          fn.apply(ctx, args);
        });
      }
      else {
        console.log(' => Suman warning => function was called more than once -' + fn ? fn.toString() : '');
        if (err) {
          console.error(' => Suman warning => \n', err.stack || util.inspect(err));
        }
      }

    }
  },

  checkForEquality: function (arr1: Array<string>, arr2: Array<string>): boolean {

    if (arr1.length !== arr2.length) {
      return false;
    }

    arr1 = arr1.sort();
    arr2 = arr2.sort();

    for (let i = 0; i < arr1.length; i++) {
      if (String(arr1[i]) !== String(arr2[i])) {
        return false;
      }
    }

    return true;
  },

  arrayHasDuplicates: function arrayHasDuplicates (a: Array<string>) : boolean {
    return _.uniq(a).length !== a.length;
  },

  makeResultsDir: function (bool: boolean, cb: Function): void {

    if (!bool) {
      process.nextTick(cb);
    }
    else {

      process.nextTick(function () {
        cb(null);
      });

    }
  }

};

