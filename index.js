'use strict';

var through = require('through2');
var rs = require('replacestream');
var istextorbinary = require('istextorbinary');

function wrapWithFile(func, file) {
    if (typeof func != 'function')
        return func;

    var new_func = function() {
        var args = [];
        for (var i=0; i<arguments.length; i++) {
            args[i] = arguments[i];
        }
        args.push(file);
        return func.apply(this, args);
    };

    return new_func;
}


module.exports = function(search, replacement, options) {
  var doReplace = function(file, enc, callback) {
    var repl = wrapWithFile(replacement, file);

    if (file.isNull()) {
      return callback(null, file);
    }

    function doReplace() {
      if (file.isStream()) {
        file.contents = file.contents.pipe(rs(search, repl));
        return callback(null, file);
      }

      if (file.isBuffer()) {
        if (search instanceof RegExp) {
          file.contents = new Buffer(String(file.contents).replace(search, repl));
        }
        else {
          var chunks = String(file.contents).split(search);

          var result;
          if (typeof repl === 'function') {
            // Start with the first chunk already in the result
            // Replacements will be added thereafter
            // This is done to avoid checking the value of i in the loop
            result = [ chunks[0] ];

            // The replacement function should be called once for each match
            for (var i = 1; i < chunks.length; i++) {
              // Add the replacement value
              result.push(repl(search, file));

              // Add the next chunk
              result.push(chunks[i]);
            }

            result = result.join('');
          }
          else {
            result = chunks.join(repl);
          }

          file.contents = new Buffer(result);
        }
        return callback(null, file);
      }

      callback(null, file);
    }

    if (options && options.skipBinary) {
      istextorbinary.isText('', file.contents, function(err, result) {
        if (err) {
          return callback(err, file);
        }

        if (!result) {
          callback(null, file);
        } else {
          doReplace();
        }
      });

      return;
    }

    doReplace();
  };

  return through.obj(doReplace);
};
