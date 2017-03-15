# gulp-better-rollup 

A [Gulp](https://www.npmjs.com/package/gulp) plugin for [Rollup](https://www.npmjs.com/package/rollup) ES6 Bundler. This plugin unlike [gulp-rollup](https://www.npmjs.com/package/gulp-rollup) integrates Rollup deeper into Gulps pipeline chain by taking some of the Rollup API out of your hands in exchange of giving you the full power over the pipeline (to use any gulp plugins).

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
      // notice there is no `entry` option as rollup integrates into gulp pipeline
      plugins: [babel()]
    }, {
      // also rollups `sourceMap` option is replaced by gulp-sourcemaps plugin
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
    // note that UMD and IIFE format requires `moduleName` but it was guessed based on source file `mylibrary.js`
    .pipe(rollup({plugins: [babel()]}, 'umd'))
    // save sourcemap as separate file (in the same folder)
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dist'))
})
```

## Usage & Options

### `rollup([rollupOptions,] generateOptions)`

This plugin is based on [the standard Rollup options](https://github.com/rollup/rollup/wiki/JavaScript-API), with following caveats

#### `rollupOptions`
First argument is object of options found you would specify as [`rollup.rollup(options)` in Rollup API](https://github.com/rollup/rollup/wiki/JavaScript-API#rolluprollup-options-)

`entry` should not be used as the entry file is provided by gulp. It also works with gulp-watch

``` js
  gulp.src('src/app.js')
    .pipe(watch('src/*.js'))
    .pipe(rollup({...}, 'umd'))
    .pipe(gulp.dest('./dist'))
```

But if you really need it for some bizzare reason then you can specify custom entry like so

``` js
  gulp.src('src/app.js')
    .pipe(someRealityBendingPlugin(...))
    .pipe(rollup({
      entry: 'src/app.js'
    }, 'umd'))
    .pipe(gulp.dest('./dist'))
```

`cache` is enabled by default and taken care of by the plugin because usage in cojunction with watchers like [gulp-watch](https://www.npmjs.com/package/gulp-watch) is expected. It can be however disabled by settings `cache` to `false`

#### `generateOptions`

Second argument is object of options describing output format of the bundle. It's the same thing you would specify as [`bundle.generate(options)` in Rollup API](https://github.com/rollup/rollup/wiki/JavaScript-API#bundlegenerate-options-) or as a single item of  `targets` in `rollup.config.js`

`moduleName` and `moduleId` are by default assigned by filename but can be explicitly specified

**Caveat:** Exporting to UMD or IIFE format requires to specify `moduleName`. This plugin takes care of autoassigning it based on filename. But if your main file is named `index.js` or `main.js` then your module will be also named `index` or `main`.

**Caveat:** If you don't want `moduleId` to be automatically assigned for your AMD modules, set `moduleId` it to empty string `.pipe(rollup({moduleId:''}))`

`intro/outro` are discouraged to use in favor of gulps standard plugins like [gulp-header](https://www.npmjs.com/package/gulp-header) and [gulp-footer](https://www.npmjs.com/package/gulp-footer)

`sourceMap` option is omitted. Use the standard [gulp-sourcemaps](https://www.npmjs.com/package/gulp-sourcemaps) plugin instead.

`sourceMapFile` is unvailable as well.

#### shortcuts

If you don't need to define `plugins` like babel, use `external` modules, explicitly specify `entry` file, or any other options of `rollupOptions` object, you can just skip this first argument alltogether. Also `generateOptions` can be replaced by string of module format if you only export in a single format.

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup('es'))
    .pipe(gulp.dest('dist'))
})
```

**Both `rollupOptions` and `generateOptions` can be also specified as a single object** if you preffer simplicity over semantically relying on the Rollup JS API. This could also come in handy as setting defaults for `generateOptions` when you export multiple formats and you don't want to copy-paste the same `exports` and `blobal` options.

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup({
      treeshake: false,
      plugins: [require('rollup-plugin-babel')],
      external: ['first-dep', 'OtherDependency'],
    }, {
      moduleName: 'CustomModuleName',
      format: 'umd',
    }))
    .pipe(gulp.dest('dist'))
})
```

Can be simplified into

``` js
gulp.task('dev', function() {
  gulp.src('lib/mylib.js')
    .pipe(rollup({
      treeshake: false,
      plugins: [require('rollup-plugin-babel')],
      external: ['first-dep', 'OtherDependency'],
      moduleName: 'CustomModuleName',
      format: 'umd',
    }))
    .pipe(gulp.dest('dist'))
})
```

#### exporting multiple bundles

Array of `generateOptions` can be provided to export into multiple formats.

```js
var pkg = require('./package.json')
gulp.task('build', function() {
  gulp.src('lib/mylib.js')
    .pipe(sourcemaps.init())
    .pipe(rollup(rollupOptions, [{
      dest: pkg['jsnext:main'],
      format: 'es',
    }, {
      dest: pkg['main'],
      format: 'umd',
    }]))
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('dist'))
})
```

**Caveat 1:** `dest` can take path instead of just a file name, but the file won't be saved there. Exporting files from gulp always relies on the `.pipe(gulp.dest(...))` and not the plugin itself.

**Caveat 2:** `gulp-sourcemaps` plugin doesn't (yet) support the `.mjs` extension you might want to use to export ES format into. Specifically it can inline the sourcemap into the bundle file (using `sourcemaps.write()`), and it can also create external sourcemap file with `sourcemaps.write(PATH_TO_SOURCEMAP_FOLDER)`, it just won't insert the `//# sourceMappingURL=` linking comment at the end of your `.mjs` file, effectivelly rendering the sourcemap useless. 

