/**
 * Duplicity CLI helper
 * Used in the backup model
 */
(function(require, m)
{

    'use strict';

    var exec = require('child_process').exec;
    var os = require('os');
    var moment = require('moment');

    var module = function()
    {

        var process = null;
        var cancelled = false;
        var outputCallback = null;
        var maxBuffer = 1024 * 1000;
        var verbosityLevel = 'notice';

        /**
         * Checks if a process is running
         */
        this.isProcessing = function()
        {
            return process !== null;
        };

        /**
         * Registers a callback to be triggered when an output is received from the CLI tool
         * @param callback
         */
        this.onOutput = function(callback)
        {
            outputCallback = callback;
        };

        /**
         * Starts a backup task
         * @param data
         * @param type (full | "")
         * @param callback
         */
        this.doBackup = function(data, type, callback)
        {
            var options = {env: {PASSPHRASE: data.passphrase, TMPDIR: os.tmpdir()}, maxBuffer: maxBuffer};
            var command = 'duplicity ' + type + ' "' + data.path + '" "' + data.url + '" ' + data.cli_options + ' --verbosity ' + verbosityLevel;
            process = exec(command, options, function(error, stdout, stderr)
            {
                process = null;
                callback(cancelled || error !== null);
            });
            process.stdout.on('data', _onStdout.bind(this));
            process.stderr.on('data', _onStderr.bind(this));
        };

        /**
         * Tries to get a file and save it on the given path
         * @param data
         * @param path
         * @param dest_path
         * @param callback
         */
        this.restoreFile = function(data, path, dest_path, callback)
        {
            var options = {env: {PASSPHRASE: data.passphrase, TMPDIR: os.tmpdir()}, maxBuffer: maxBuffer};
            var command = 'duplicity restore --file-to-restore "' + path + '" "' + data.url + '" "' + dest_path + '"' + ' ' + data.cli_options + ' --verbosity ' + verbosityLevel;
            process = exec(command, options, function(error, stdout, stderr)
            {
                process = null;
                callback(cancelled || error !== null);
            });
            process.stdout.on('data', _onStdout.bind(this));
            process.stderr.on('data', _onStderr.bind(this));
        };

        /**
         * Tries to restore a backup
         * @param data
         * @param dest_path
         * @param callback
         */
        this.restoreTree = function(data, dest_path, callback)
        {
            var options = {env: {PASSPHRASE: data.passphrase, TMPDIR: os.tmpdir()}, maxBuffer: maxBuffer};
            var command = 'duplicity restore "' + data.url + '" "' + dest_path + '"' + ' ' + data.cli_options + ' --verbosity ' + verbosityLevel;
            process = exec(command, options, function(error, stdout, stderr)
            {
                process = null;
                callback(cancelled || error !== null);
            });
            process.stdout.on('data', _onStdout.bind(this));
            process.stderr.on('data', _onStderr.bind(this));
        };

        /**
         * Lists the current files in a backup
         * @param data
         * @param callback
         */
        this.getFiles = function(data, callback)
        {
            var options = {env: {PASSPHRASE: data.passphrase, TMPDIR: os.tmpdir()}, maxBuffer: maxBuffer};
            var command = 'duplicity list-current-files ' + data.url + ' ' + data.cli_options + ' --verbosity ' + verbosityLevel;
            process = exec(command, options, function(error, stdout, stderr)
            {
                var regex = /^[a-zA-Z]{3} [a-zA-Z]{3} [0-9 :]+(.*)$/gm;
                var tree = [];
                var match;
                while (match = regex.exec(stdout))
                {
                    if (match[1] !== 'undefined')
                    {
                        var path = match[1];
                        if (path !== '.' && path !== '..')
                        {
                            tree.push({
                                path: path,
                                dir: path.search('/') !== -1 ? path.substring(0, path.lastIndexOf('/')) : '.',
                                name: path.substring(path.lastIndexOf('/') + 1)
                            });
                        }
                    }
                }
                process = null;
                callback(error !== null, tree);
            });
            process.stdout.on('data', _onStdout.bind(this));
            process.stderr.on('data', _onStderr.bind(this));
        };

        /**
         * Gets the current status of a backup
         * @param data
         * @param callback
         */
        this.getStatus = function(data, callback)
        {
            var options = {env: {PASSPHRASE: data.passphrase, TMPDIR: os.tmpdir()}, maxBuffer: maxBuffer};
            var command1 = 'duplicity collection-status ' + data.url + ' ' + data.cli_options + ' --verbosity ' + verbosityLevel;
            var command2 = 'duplicity incremental ' + data.path + ' ' + data.url + ' ' + data.cli_options + ' --verbosity ' + verbosityLevel + ' --dry-run';
            process = exec(command1 + ' && ' + command2, options, function(error, stdout, stderr)
            {
                var data = {};
                var chain_start_time = new RegExp('Chain start time: ([^\n]+)', 'gm').exec(stdout);
                var chain_end_time = new RegExp('Chain end time: ([^\n]+)', 'gm').exec(stdout);
                var backup_sets = new RegExp('Number of contained backup sets: ([0-9]+)', 'gm').exec(stdout);
                var source_files = new RegExp('SourceFiles ([0-9]+)', 'g').exec(stdout);
                var source_file_size = new RegExp('SourceFileSize [0-9]+ [(]([^)]+)[)]', 'g').exec(stdout);
                var backup_volumes = new RegExp('Total number of contained volumes: ([0-9]+)', 'gm').exec(stdout);
                data.chain_start_time = chain_start_time !== null && typeof chain_start_time[1] !== 'undefined' ? Date.parse(chain_start_time[1]) : '';
                data.chain_end_time = chain_end_time !== null && typeof chain_end_time[1] !== 'undefined' ? Date.parse(chain_end_time[1]) : '';
                data.backup_sets = backup_sets !== null && typeof backup_sets[1] !== 'undefined' ? backup_sets[1] : '';
                data.backup_volumes = backup_volumes !== null && typeof backup_volumes[1] !== 'undefined' ? backup_volumes[1] : '';
                data.chain_start_time = data.chain_start_time !== '' ? moment(data.chain_start_time).format('YYYY-MM-DD HH:mm') : '';
                data.chain_end_time = data.chain_end_time !== '' ? moment(data.chain_end_time).format('YYYY-MM-DD HH:mm') : '';
                data.source_files = source_files !== null && typeof source_files[1] !== 'undefined' ? source_files[1] : '';
                data.source_file_size = source_file_size !== null && typeof source_file_size[1] !== 'undefined' ? source_file_size[1] : '';
                process = null;
                callback(error !== null, data);
            });
            process.stdout.on('data', _onStdout.bind(this));
            process.stderr.on('data', _onStderr.bind(this));
        };

        /**
         * Kills the current process
         */
        this.cancel = function()
        {
            cancelled = true;
            process.kill('SIGINT');
        };

        /**
         * Sends stdout
         * @param out
         */
        var _onStdout = function(out)
        {
            outputCallback(out);
        };

        /**
         * Sends stderr
         * @param out
         */
        var _onStderr = function(out)
        {
            outputCallback('<!--:error-->' + out + '<!--error:-->');
        };

    };

    m.exports = module;

})(require, module);