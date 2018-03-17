'use strict'

var path = require('path')
var should = require('should')
var File = require('vinyl')
var sourceMaps = require('gulp-sourcemaps')
var rollup = require('..')


var cwd = process.cwd()
var fixtureDir = path.join(__dirname, 'fixture')

function fileFactory(filename) {
	return new File({
		cwd: cwd,
		base: fixtureDir,
		path: path.join(fixtureDir, filename),
		contents: new Buffer('dumy content not used by gulp'),
	})
}

describe('gulp-better-rollup', function() {

	it('should pass file when it isNull()', done => {
		var stream = rollup()
		var emptyFile = {
			isNull: () => true
		}
		stream.once('data', data => {
			data.should.equal(emptyFile)
			done()
		})
		stream.write(emptyFile)
		stream.end()
	})

	it('should emit error when file isStream()', done => {
		var stream = rollup()
		var streamFile = {
			isNull: () => false,
			isStream: () => true
		}
		stream.once('error', function (err) {
			err.message.should.equal('Streaming not supported')
			done()
		})
		stream.write(streamFile)
		stream.end()
	})

	it('should bundle es format using Rollup', done => {
		var stream = rollup('es')

		stream.once('data', data => {
			var result = data.contents.toString().replace(/\n/gm, '').trim()
			result.should.equal('var something = \'doge\';console.log(something);')
			done()
		})

		stream.write(fileFactory('app.js'))

		stream.end()
	})

	it('should bundle multiple formats using Rollup', done => {
		var stream = rollup([{
			file: 'output1.mjs',
			format: 'es'
		}, {
			file: 'output2.js',
			format: 'cjs'
		}])

		var files = 0
		var filenames = ['output1.mjs', 'output2.js']
		stream.on('data', data => {
			var filename = path.relative(data.base, data.path)
			filenames.should.containEql(filename)
			files++
		})
		stream.on('end', data => {
			files.should.eql(2)
			done()
		})

		stream.write(fileFactory('app.js'))

		stream.end()
	})

	it('should bundle umd format with autodetected module name', done => {
		var stream = rollup({
			format: 'umd'
		})

		stream.once('data', data => {
			var result = data.contents.toString().trim()
			should(result.startsWith('(function')).ok
			should(result.includes('define(\'util')).ok
			should(result.includes('global.util = global.util || {}')).ok
			done()
		})

		stream.write(fileFactory('util.js'))

		stream.end()
	})

	it('should not create sourceMaps without gulp-sourcemaps', done => {
		var stream = rollup('umd')

		stream.once('data', data => {
			should.not.exist(data.sourceMap)
			done()
		})

		stream.write(fileFactory('util.js'))

		stream.end()
	})

	it('should create sourceMaps by default', done => {
		var init = sourceMaps.init()
		var write = sourceMaps.write()

		var stream = rollup('umd')

		init.pipe(stream)
			.pipe(write)

		write.once('data', data => {
			should(data.sourceMap).be.ok
			data.sourceMap.file.should.be.equal('app.js')
			data.sourceMap.mappings.should.not.be.empty
			done()
		})

		init.write(fileFactory('app.js'))

		init.end()
	})

	it('should create a bundle with globals from cache', done => {
		var stream = rollup({
			external: ['jquery']
		}, {
			format: 'iife',
			globals: {
				jquery: 'jQuery'
			}
		})

		var resultsCount = 0
		stream.on('data', data => {
			var code = data.contents.toString().replace(/\n/gm, '').trim()
			code.should.equal("var importsGlobal = (function ($) {'use strict';$ = $ && $.hasOwnProperty('default') ? $['default'] : $;var importsGlobal = $.trim;return importsGlobal;}(jQuery));")
			++resultsCount
		})
		stream.on('end', data => {
			resultsCount.should.eql(2)
			done()
		})

		stream.write(fileFactory('importsGlobal'))
		stream.write(fileFactory('importsGlobal'))
		stream.end()
	})


})
