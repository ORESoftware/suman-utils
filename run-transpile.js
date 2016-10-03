/**
 * Created by denman on 5/23/2016.
 */


//core
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');

//project
const sumanUtils = require('./utils');

///////////////////////////////////////////

const root = process.env.SUMAN_PROJECT_ROOT;
const testDir = process.env.TEST_DIR;
const testSrcDir = process.env.TEST_SRC_DIR;
const testDestDir = process.env.TEST_DEST_DIR;
const testDirCopyDir = process.env.TEST_DIR_COPY_DIR;
const targetDir = path.resolve(testDirCopyDir ? testDirCopyDir : (testDir + '-target'));

if (process.env.SUMAN_DEBUG === 'yes') {
    console.log(' SUMAN_DEBUG message (in suman-utils) => process.env =', util.inspect(process.env));
}

////////////////////////////////////////////

function mapToTargetDir(item) {

    item = path.resolve(path.isAbsolute(item) ? item : (root + '/' + item));

    const paths = sumanUtils.removeSharedRootPath([root, item]);

    const temp = paths[1][1];

    if (global.sumanOpts.vverbose || process.env.SUMAN_DEBUG === 'yes') {
        console.log('temp path:', temp);
    }

    const splitted = temp.split(path.sep);

    console.log('splitted:', splitted);

    splitted.shift();
    splitted.shift();
    splitted.shift();

    console.log('splitted after shift:', splitted);


    const joined = splitted.join(path.sep);

    if (global.sumanOpts.vverbose || process.env.SUMAN_DEBUG === 'yes') {
        console.log('pre-resolved:', joined);
    }


    console.log('joined:', joined);


    return {
        originalPath: item,
        targetPath: path.resolve(targetDir + '/' + joined)
        // targetPath: path.resolve(targetDir)
    }
}

function run(paths, opts, cb) {


    // const result = dirs.every(function (dir) {
    // 	try {
    // 		assert(String(dir).indexOf(path.sep) < 1);
    // 	}
    // 	catch (err) {
    // 		return false;
    // 	}
    // 	return true;
    // });
    //
    // if (!result) {
    // 	return cb(new Error('Please pass only relative paths to top-level directories in your project.'));
    // }
    // else {
    // 	dirs = dirs.map(function (dir) {
    // 		return path.resolve(dir);
    // 	});
    // }

    // dirs = dirs.map(function (dir) {
    // 	return path.resolve(dir);
    // });

    if (opts.all) {


        console.log('opts.all for transpile is true');

        // if (dirs.length < 1) {
        //     if (testDir && typeof testDir === 'string') {
        //         dirs = [testDir];
        //     }
        //     else {
        //         return cb(new Error('No test directory specified at command line, and no testDir property defined in your suman config.'))
        //     }
        // }

        try {
            assert(testDir && typeof testDir === 'string');
        }
        catch (err) {
            return cb(new Error('You wanted a transpilation run, but you need to define the testDir ' +
                'property in your suman.conf.js file.' + '\n' + err.stack));
        }

        if (paths.length > 0) {
            console.error(colors.yellow(' => Suman warning => Because the --all option was used,' +
                ' suman will ignore the following arguments passed at the command line:'), '\n', paths);
        }

        //TODO: use rimraf or what not, instead of cp
        cp.exec('rm -rf ' + targetDir, function (err, stdout, stderr) {
            if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                cb(err || stdout || stderr);
            }
            else {

                const cmd1 = 'cd ' + root + ' && ./node_modules/.bin/babel ' + testDir + ' --out-dir ' + targetDir
                    + ' --copy-files';

                if (opts.verbose) {
                    console.log('\n', 'Babel-cli command:', cmd1, '\n');
                }

                cp.exec(cmd1, function (err) {
                    if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                        cb('You may need to run $ suman --use-babel to install the' +
                            ' necessary babel dependencies in your project so suman can use them => \n' + (err.stack || err) || stdout || stderr);
                    }
                    else {
                        console.log(stdout ? '\n' + stdout : '');
                        console.log(stderr ? '\n' + stderr : '');

                        if (!global.sumanOpts.sparse) {
                            console.log('\t' + colors.bgGreen.white.bold(' => Suman messsage => Your entire "' + testDir + '" directory '));
                            console.log('\t' + colors.bgGreen.white.bold(' was successfully transpiled/copied to the "' + targetDir + '" directory. ') + '\n');
                        }

                        setImmediate(function () {
                            cb(null, paths.map(mapToTargetDir));
                        });

                        // const cmd2 = 'cd ' + root + ' && babel ' + testDir + ' --out-dir test-target'
                        // 	+ ' --only ' + dirs[0];
                        //
                        // if (opts.verbose) {
                        // 	console.log('\n', 'Babel-cli command 2:', cmd2, '\n');
                        // }
                        //
                        // cp.exec(cmd2, cb);
                    }

                });

                /*		async.each(dirs, function (item, cb) {

                 item = path.resolve(path.isAbsolute(item) ? item : (root + '/' + item));

                 // const truncated = sumanUtils.removeSharedRootPath([item, targetTestDir]);
                 // const file = truncated[0][1];
                 // const indexOfFirstStart = String(file).indexOf('*');
                 // var temp = String(file);
                 // if (indexOfFirstStart > -1) {
                 // 	temp = temp.substring(0, indexOfFirstStart);
                 // }

                 // console.log('temp:',temp);

                 // const cmd = 'cd ' + root + ' && babel ' + item + ' --out-dir test-target' + temp + ' --copy-files';

                 const cmd = 'cd ' + root + ' && babel ' + item + ' --out-dir test-target' + ' --copy-files';

                 if (opts.verbose) {
                 console.log('\n', 'Babel-cli command:', cmd, '\n');
                 }

                 cp.exec(cmd, cb);

                 }, cb);*/
            }

        });
    }
    else {  //opts.all == false


        console.log('opts.all for transpile is false');

        //here we want two things to be faster:
        //no runner, so we save 100ms
        //transpile and option to only copy only 1 .js file

        // if (dirs.length > 0) {
        // 	return cb(new Error('--optimized option uses the testSrcDirectory property of your config, ' +
        // 		'but you specified a dir option as an argument.'))
        // }
        //
        // dirs = [testDir];

        if (opts.sameDir) {


            console.log('opts.sameDir for transpile is true');

            try {
                assert(testDir && testSrcDir && testDestDir &&
                    typeof testDir === 'string' && typeof testSrcDir === 'string' && typeof testDestDir === 'string');
            }
            catch (err) {
                return cb(new Error('You wanted an transpilation run, but you need to define the testDir ' +
                    'and testSrcDir properties in your suman.conf.js file.'))
            }

            cp.exec('cd ' + root + ' && rm -rf ' + testDestDir, function (err, stdout, stderr) {
                if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                    cb(err || stdout || stderr);
                }
                else {
                    // async.each(dirs, function (item, cb) {
                    //
                    // 	// item = path.resolve(path.isAbsolute(item) ? item : (root + '/' + item));
                    //
                    // 	const cmd = 'cd ' + root + ' && babel ' + item + ' --out-dir ' + str3 + ' --only ' + item;
                    //
                    // 	if (opts.verbose) {
                    // 		console.log('\n', 'Babel-cli command:', cmd, '\n');
                    // 	}
                    //
                    // 	cp.exec(cmd, cb);
                    //
                    // }, cb);

                    // const cmd = 'cd ' + root + ' && babel ' + str2 + ' --out-dir ' + str3 + ' --only ' + item;

                    var cmd = 'cd ' + root + ' && ./node_modules/.bin/babel ' + testSrcDir + ' --out-dir ' + testDestDir;

                    paths.forEach(function (item) {
                        cmd += ' --only ' + item;
                    });

                    if (opts.verbose) {
                        console.log('\n', 'Babel-cli command:', cmd, '\n');
                    }

                    cp.exec(cmd, function (err, stdout, stderr) {
                        if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                            cb('You may need to run $ suman --use-babel to install the' +
                                ' necessary babel dependencies in your project so suman can use them => \n' + (err.stack || err) || stdout || stderr);
                        }
                        else {
                            cb(null);
                        }
                    });

                }
            });

        }
        else {


            console.log('opts.sameDir for transpile is false');


            try {
                assert(paths.length > 0, colors.bgBlack.yellow(' => Suman error => please pass at least one test file path in your command.'));
            }
            catch (err) {
                return cb(err);
            }

            if (process.env.SUMAN_DEBUG === 'yes') {
                console.log(' => testDirCopyDir:', testDirCopyDir);
                console.log(' => paths before array =>', util.inspect(paths));
            }

            paths = paths.map(item => {
                return path.resolve(path.isAbsolute(item) ? item : (root + '/' + item));
            });

            if (process.env.SUMAN_DEBUG === 'yes') {
                console.log(' => paths after array =>', util.inspect(paths));
            }

            //TODO: should be paths[0], need to build up directories for all paths
            const dirsToBuild = sumanUtils.getArrayOfDirsToBuild(testDirCopyDir, paths[0]);

            console.log('dirsToBuild:', dirsToBuild);

            sumanUtils.buildDirs(dirsToBuild, function (err) {  //make test-target dir in case it doesn't exist

                if (err) {
                    cb(err);
                }
                else {
                    async.map(paths, function (item, cb) {

                        const fsItemTemp = mapToTargetDir(item);
                        const fsItem = fsItemTemp.targetPath;

                        if (opts.vverbose || process.env.SUMAN_DEBUG === 'yes') {
                            console.log('Item to be transpiled:', item);
                            console.log('Root of project:', root);
                        }


                        if (opts.vverbose || process.env.SUMAN_DEBUG === 'yes') {
                            console.log('targetDir:', targetDir);
                            console.log('fsItem:', fsItem);
                        }

                        var cmd;
                        try {
                            if (fs.statSync(item).isFile()) {

                                console.log('item is a file: yo');

                                if (path.extname(item) === '.js' || path.extname(item) === '.jsx') {
                                    cmd = 'cd ' + root + ' && ./node_modules/.bin/babel ' + item + ' --out-file ' + fsItem;
                                    console.log('\n ' + colors.bgCyan.magenta.bold(' => Test file will be transpiled to => ' + fsItem));
                                }
                                else {
                                    cmd = 'cd ' + root + ' && cp ' + item + ' ' + fsItem;
                                    console.log('\n ' + colors.bgCyan.magenta.bold(' => Test fixture file will be copied to => ' + fsItem));
                                }
                            }
                            else {

                                console.log('item is a DIR: yo', fsItem);

                                cmd = 'cd ' + root + ' && ./node_modules/.bin/babel ' + item + ' --out-dir ' + fsItem + ' --copy-files';
                                console.log(' ' + colors.bgCyan.white.bold(' => Test dir will be transpiled to =>'), '\n', colors.bgMagenta.white(fsItem));
                            }

                        }
                        catch (err) {
                            return cb(err, []);
                        }

                        if (opts.verbose) {
                            console.log('\n', 'Babel-cli command:', cmd, '\n');
                        }

                        cp.exec(cmd, function (err, stdout, stderr) {
                            if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                                cb('You may need to run "$ suman --use-babel" to install the' +
                                    ' necessary babel dependencies in your project so suman can use them => \n' + (err.stack || err) || stdout || stderr);
                            }
                            else {
                                cb(null, fsItemTemp)
                            }
                        });

                    }, cb);
                }

            });

        }

    }

}

module.exports = run;
