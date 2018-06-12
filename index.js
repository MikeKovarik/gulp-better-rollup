'use strict'

var Transform = require('stream').Transform
var File = require('vinyl')
var PluginError = require('plugin-error')
var rollup = require('rollup')
var path = require('path')
var applySourceMap = require('vinyl-sourcemaps-apply')
var camelCase = require('lodash.camelcase')

var PLUGIN_NAME = 'gulp-better-rollup'

// map object storing rollup cache objects for each input file
var rollupCache = new Map

function parseBundles(arg) {
	if (typeof arg == 'string')
		return [{format: arg}]
	if (arg instanceof Array)
		return arg
	return [arg]
}

function assignCertainProperties(toObject, fromObject, properties = []) {
	for (var key of properties) {
		if (toObject[key] === undefined && fromObject[key] !== undefined)
			toObject[key] = fromObject[key]
	}
}

// transformer class
class GulpRollup extends Transform {

	_transform(file, encoding, cb) {
		// cannot handle empty or unavailable files
		if (file.isNull())
			return cb(null, file)

		// cannot handle streams
		if (file.isStream())
			return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'))

		if (this.arg2) {
			var inputOptions = Object.assign({}, this.arg1)
			var bundleList = parseBundles(this.arg2)
		} else {
			var inputOptions = {}
			var bundleList = parseBundles(this.arg1)
		}

		// user should not specify the input file path, but let him if he insists for some reason
		if (inputOptions.input === undefined)
			// determine input from file filename
			inputOptions.input = path.relative(file.cwd, file.path)
		else
			// rename file if input is given
			file.path = path.join(file.cwd, inputOptions.input)

		// caching is enabled by default because of the nature of gulp and the watching/recompilatin
		// but can be disabled by setting 'cache' to false
		if (inputOptions.cache !== false)
			inputOptions.cache = rollupCache.get(inputOptions.input)

		// enable sourcemap is gulp-sourcemaps plugin is enabled
		var createSourceMap = file.sourceMap !== undefined

		var originalCwd = file.cwd
		var originalPath = file.path
		var moduleName = camelCase(path.basename(file.path, path.extname(file.path)))

		function generateAndApplyBundle(bundle, outputOptions, targetFile) {
			// Sugaring the API by copying convinience objects and properties from inputOptions
			// to outputOptions (if not defined)
			// Directly copied from https://rollupjs.org/guide/en#outputoptions
			var propsToCopy = [
				// core options
				'format', 'file', 'dir', /*'name'*/, 'globals',
				// advanced options
				'paths', 'banner', 'footer', 'intro', 'outro', 'sourcemap', 'sourcemapFile', 'interop', 'extend',
				// danger zone
				'exports', /*'amd',*/ 'indent', 'strict', 'freeze', 'legacy', 'namespaceToStringTag',
			]
			assignCertainProperties(outputOptions, inputOptions, propsToCopy)
			// Rollup won't bundle iife and umd modules without module name.
			// But it won't say anything either, leaving a space for confusion
			if (outputOptions.name === undefined)
				outputOptions.name = inputOptions.name || moduleName
			if (outputOptions.amd === undefined || outputOptions.amd.id === undefined)
				outputOptions.amd = Object.assign({}, outputOptions.amd, {id: outputOptions.name})
			outputOptions.sourcemap = createSourceMap
			// generate bundle according to given or autocompleted options
			return bundle.generate(outputOptions).then(result => {
				if (result === undefined) return
				// Pass sourcemap content and metadata to gulp-sourcemaps plugin to handle
				// destination (and custom name) was given, possibly multiple output bundles.
				if (createSourceMap) {
					result.map.file = path.relative(originalCwd, originalPath)
					result.map.sources = result.map.sources.map(source => path.relative(originalCwd, source))
				}
				// return bundled file as buffer
				targetFile.contents = Buffer.from(result.code)
				// apply sourcemap to output file
				if (createSourceMap)
					applySourceMap(targetFile, result.map)
			})
		}
		var createBundle = (bundle, outputOptions, injectNewFile) => {
			// custom output name might be set
			if (outputOptions.file) {
				// setup filename name from outputOptions.file
				var newFileName = path.basename(outputOptions.file)
				var newFilePath = path.join(file.base, newFileName)
				if (injectNewFile) {
					// create new file and inject it into stream if needed (in case of multiple outputs)
					var newFile = new File({
						cwd: file.cwd,
						base: file.base,
						path: newFilePath,
						stat: {
							isFile: () => true,
							isDirectory: () => false,
							isBlockDevice: () => false,
							isCharacterDevice: () => false,
							isSymbolicLink: () => false,
							isFIFO: () => false,
							isSocket: () => false
						}
					})
					return generateAndApplyBundle(bundle, outputOptions, newFile).then(result => {
						this.push(newFile)
						return result
					})
				} else {
					// rename original file
					file.path = newFilePath
					return generateAndApplyBundle(bundle, outputOptions, file)
				}
			} else {
				// file wasnt renamed nor new one was created,
				// apply data and sourcemaps to the original file
				return generateAndApplyBundle(bundle, outputOptions, file)
			}
		}


		// custom rollup can be provided inside the config object
		rollup = inputOptions.rollup || rollup
		delete inputOptions.rollup
		rollup
			// pass basic options to rollup
			.rollup(inputOptions)
			// after the magic is done, configure the output format
			.then(bundle => {
				// cache rollup object if caching is enabled
				if (inputOptions.cache !== false)
					rollupCache.set(inputOptions.input, bundle)
				// generate ouput according to (each of) given outputOptions
				return Promise.all(bundleList.map((outputOptions, i) => createBundle(bundle, outputOptions, i)))
			})
			// pass file to gulp and end stream
			.then(() => cb(null, file))
			.catch(err => {
				if (inputOptions.cache !== false)
					rollupCache.delete(inputOptions.input)
				process.nextTick(() => {
					this.emit('error', new PluginError(PLUGIN_NAME, err))
					cb(null, file)
				})
			})

	}

}

// first argument (inputOptions) is optional
module.exports = function factory(arg1, arg2) {
	// instantiate the stream class
	var stream = new GulpRollup({objectMode: true})
	// pass in options objects
	stream.arg1 = arg1
	stream.arg2 = arg2
	// return the stream instance
	return stream
}
