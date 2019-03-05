# gulp-better-rollup

[![Build Status](https://travis-ci.org/MikeKovarik/gulp-better-rollup.svg?branch=master)](https://travis-ci.org/MikeKovarik/gulp-better-rollup) [![Greenkeeper badge](https://badges.greenkeeper.io/MikeKovarik/gulp-better-rollup.svg)](https://greenkeeper.io/)

A [Gulp](https://www.npmjs.com/package/gulp) plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 Bundler. In comparison with [gulp-rollup](https://www.npmjs.com/package/gulp-rollup), this plugin integrates Rollup deeper into Gulps pipeline chain. It takes some of the Rollup API out of your hands, in exchange for giving you full power over the pipeline (to use any gulp plugins).

## How it works

Rollup is designed to handle reading files, building a dependency tree, transforming content and then writing the transformed files. This doesn't play well with gulp, since gulp is also designed to handle files with `gulp.src()` and `gulp.dest()`. Gulp plugins, by design _should_ just handle in-memory transformations. Not actual files.

To tackle this problem gulp-better-rollup passes the file paths loaded in `gulp.src()` to rollup, rather than the gulp buffer.

This comes with some caveats:

* If you use other gulp plugin before gulp-better-rollup, their transformations will be lost. If the plugin doesn't do source transformations (like for example [gulp-sourcemaps](https://www.npmjs.com/package/gulp-sourcemaps)) this is fine.
* The Rollup "input" argument is unsupported.
* Since the output location is determined by `gulp.dest()`, the output "file" argument passed to Rollup can at most be used to set the file name for a bundle. If you pass a full directory path, only the file name part will be used. In addition, if you pass a file path to `gulp.dest()`, the Rollup "file" argument will be ignored entirely.
* The `gulp-sourcemaps` plugin doesn't (yet) support the `.mjs` extension, that you may want to use to support the ES module format in Node.js. It can inline the sourcemap into the bundle file (using `sourcemaps.write()`), and create an external sourcemap file with `sourcemaps.write(PATH_TO_SOURCEMAP_FOLDER)`. It won't however insert the `//# sourceMappingURL=` linking comment at the end of your `.mjs` file, which effectively renders the sourcemaps useless.

## Installation

```
npm install gulp-better-rollup --save-dev
```

You also need to install your own rollup (version 1.x.x). `gulp-better-rollup` depends on your `rollup` as a peer-dependency.

```
npm install rollup@^1 --save-dev
```

## Usage

``` js
var gulp = require('gulp')
var rename = require('gulp-rename')
var sourcemaps = require('gulp-sourcemaps')
var rollup = require('gulp-better-rollup')
var babel = require('rollup-plugin-babel')

gulp.task('lib-build', () => {
  gulp.src('lib/index.js')
    .pipe(sourcemaps.init())
    .pipe(rollup({
      // There is no `input` option as rollup integrates into the gulp pipeline
      plugins: [babel()]
    }, {
      // Rollups `sourcemap` option is unsupported. Use `gulp-sourcemaps` plugin instead
      format: 'cjs',
    }))
    // inlining the sourcemap into the exported .js file
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist'))
})
```

Or simply:

``` js
gulp.task('lib-build', () => {
  gulp.src('lib/mylibrary.js')
    .pipe(sourcemaps.init())
    // note that UMD and IIFE format requires `name` but it will be inferred from the source file name `mylibrary.js`
    .pipe(rollup({plugins: [babel()]}, 'umd'))
    // save sourcemap as separate file (in the same folder)
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dist'))
})
```

## Usage & Options

### `rollup([inputOptions,] outputOptions)`

This plugin is based on [the standard Rollup options](https://rollupjs.org/guide/en#rollup-rollup), with the following exceptions:

#### `inputOptions`
See [`rollup.rollup(inputOptions)` in the Rollup API](https://rollupjs.org/guide/en#inputoptions)

`input` is unsupported, as the entry file is provided by gulp, which also works with [gulp-watch](https://www.npmjs.com/package/gulp-watch).

``` js
  gulp.src('src/app.js')
    .pipe(watch('src/*.js'))
    .pipe(rollup({...}, 'umd'))
    .pipe(gulp.dest('./dist'))
```

If you still need it for some reason, then you can specify a custom entry:

``` js
  gulp.src('src/app.js')
    .pipe(someRealityBendingPlugin(...))
    .pipe(rollup({
      input: 'src/app.js'
    }, 'umd'))
    .pipe(gulp.dest('./dist'))
```

`cache` is enabled by default and taken care of by the plugin, because usage in conjunction with watchers like [gulp-watch](https://www.npmjs.com/package/gulp-watch) is expected. It can however be disabled by settings `cache` to `false`.

#### `outputOptions`

Options describing the output format of the bundle. See [`bundle.generate(outputOptions)` in the Rollup API](https://rollupjs.org/guide/en#outputoptions).

`name` and `amd.id` are inferred from the module file name by default, but can be explicitly specified to override this. For example, if your main file is named `index.js` or `main.js`, then your module would also be named `index` or `main`, which you may not want.

To use [unnamed modules](http://requirejs.org/docs/api.html#modulename) for amd, set `amd.id` to an empty string, ex: `.pipe(rollup({amd:{id:''}}))`.

`intro` and `outro` are supported, but we encouraged you to use gulps standard plugins like [gulp-header](https://www.npmjs.com/package/gulp-header) and [gulp-footer](https://www.npmjs.com/package/gulp-footer).

`sourcemap` and `sourcemapFile` are unsupported. Use the standard [gulp-sourcemaps](https://www.npmjs.com/package/gulp-sourcemaps) plugin instead.

#### shortcuts

You can skip this first argument if you don't need to specify `inputOptions`.

`outputOptions` accepts a string with the module format, in case you only want to support a single format.

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup('es'))
    .pipe(gulp.dest('dist'))
})
```

**`inputOptions` and `outputOptions` can also be specified as a shared object** if you prefer simplicity over adherence to the Rollup JS API semantics.

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup({
      treeshake: false,
      plugins: [require('rollup-plugin-babel')],
      external: ['first-dep', 'OtherDependency'],
    }, {
      name: 'CustomModuleName',
      format: 'umd',
    }))
    .pipe(gulp.dest('dist'))
})
```

Can be simplified into:

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup({
      treeshake: false,
      plugins: [require('rollup-plugin-babel')],
      external: ['first-dep', 'OtherDependency'],
      name: 'CustomModuleName',
      format: 'umd',
    }))
    .pipe(gulp.dest('dist'))
})
```

#### exporting multiple bundles

`outputOptions` can be an array, in order to export to multiple formats.

```js
var pkg = require('./package.json')
gulp.task('build', function() {
  gulp.src('lib/mylib.js')
    .pipe(sourcemaps.init())
    .pipe(rollup(inputOptions, [{
      file: pkg['jsnext:main'],
      format: 'es',
    }, {
      file: pkg['main'],
      format: 'umd',
    }]))
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dist'))
})
```

## Looking for maintainer

I no longer have time to dedicate myself to the project, nor do I use it in my current projects. I'd gladly accept new maintainers.
