# gulp-better-rollup

[![Build Status](https://travis-ci.org/MikeKovarik/gulp-better-rollup.svg?branch=master)](https://travis-ci.org/MikeKovarik/gulp-better-rollup)

A [Gulp](https://www.npmjs.com/package/gulp) plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 Bundler. In comparison with [gulp-rollup](https://www.npmjs.com/package/gulp-rollup), this plugin integrates Rollup deeper into Gulps pipeline chain. It takes some of the Rollup API out of your hands, in exchange for giving you full power over the pipeline (to use any gulp plugins).

## Installation

```
npm install gulp-better-rollup --save-dev
```

## Usage

``` js
var gulp = require('gulp')
var rename = require('gulp-rename')
var rollup = require('gulp-better-rollup')
var babel = require('rollup-plugin-babel')

gulp.task('lib-build', () => {
  gulp.src('lib/index.js')
    .pipe(sourcemaps.init())
    .pipe(rollup({
      // notice there is no `input` option as rollup integrates into gulp pipeline
      plugins: [babel()]
    }, {
      // also rollups `sourcemap` option is replaced by gulp-sourcemaps plugin
      format: 'cjs',
    }))
    // inlining the sourcemap into the exported .js file
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist'))
})
```

or simply

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

### `rollup([rollupOptions,] generateOptions)`

This plugin is based on [the standard Rollup options](https://github.com/rollup/rollup/wiki/JavaScript-API), with the following exceptions:

#### `rollupOptions`
See [`rollup.rollup(options)` in the Rollup API](https://github.com/rollup/rollup/wiki/JavaScript-API#rolluprollup-options-)

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

#### `generateOptions`

Options describing the output format of the bundle. See [`bundle.generate(options)` in the Rollup API](https://github.com/rollup/rollup/wiki/JavaScript-API#bundlegenerate-options-).

`name` and `amd.id` are inferred from the module file name by default, but can be explicitly specified to override this. For example, if your main file is named `index.js` or `main.js`, then your module would also be named `index` or `main`, which you may not want.

To use [unnamed modules](http://requirejs.org/docs/api.html#modulename) for amd, set `amd.id` to an empty string, ex: `.pipe(rollup({amd:{id:''}}))`.

`intro/outro` is supported, but we encouraged you to use gulps standard plugins like [gulp-header](https://www.npmjs.com/package/gulp-header) and [gulp-footer](https://www.npmjs.com/package/gulp-footer).

`sourcemap` and `sourcemapFile` are unsupported. Use the standard [gulp-sourcemaps](https://www.npmjs.com/package/gulp-sourcemaps) plugin instead.

#### shortcuts

You can skip this first argument if you don't need to specify `rollupOptions`.

`generateOptions` accepts a string with the module format, in case you only want to support a single format.

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup('es'))
    .pipe(gulp.dest('dist'))
})
```

**`rollupOptions` and `generateOptions` can also be specified as a shared object** if you prefer simplicity over adherence to the Rollup JS API semantics.

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

`generateOptions` can be an array, in order to export to multiple formats.

```js
var pkg = require('./package.json')
gulp.task('build', function() {
  gulp.src('lib/mylib.js')
    .pipe(sourcemaps.init())
    .pipe(rollup(rollupOptions, [{
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

**Caveat 1:** `file` can take the file path instead of just a file name, but the file won't be saved there. Exporting files from gulp always relies on the `.pipe(gulp.dest(...))`, not the plugin itself.

**Caveat 2:** The `gulp-sourcemaps` plugin doesn't (yet) support the `.mjs` extension, that you may want to use to support the ES module format in Node.js. It can inline the sourcemap into the bundle file (using `sourcemaps.write()`), and create an external sourcemap file with `sourcemaps.write(PATH_TO_SOURCEMAP_FOLDER)`. It won't however insert the `//# sourceMappingURL=` linking comment at the end of your `.mjs` file, which effectively renders the sourcemaps useless. 
