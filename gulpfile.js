const gulp = require('gulp')
const pug = require('pug')
const git = require('gulp-git')
const tap = require('gulp-tap')
const dest = require('gulp')
const fs = require("fs/promises")
const path = require("path")
var hljs = require('highlight.js')
// const del = import('del')
// const markdown = import('gulp-markdown')

function clean(cb){
	import('del').then(async (del)=>{
		await del.deleteAsync(['./build', './docs'])
		cb()
	}) 
}

function clone_docs() {
	return new Promise((resolve, reject)=>{
		git.clone('https://github.com/NexTre-dev/retro-gadgets-docs', {args: './build/upstream'}, function(err) {
			if(err){reject(err)}else{resolve()}
  		});
	})
}

function build_docs(cb) {
	return import('gulp-markdown').then((markdown)=>{

		const renderer = {
			link(href, title, text) {
				href = href.replace(/\.md$/,".html")
				return `<a href="${href}" title="${title}">${text}</a>`
			},
			heading(text, level, raw, slugger){
				return `<h${level}>${text}</h${level}>${(level == 1)? `<hr>` : ``}`
			}
		}
		markdown.marked.use({ renderer })
		markdown.marked.setOptions({
			highlight: function(code, lang) {
				return hljs.highlight(lang, code).value;
			}
		})

		let index = []
		
		let siteFunction = pug.compileFile('site.pug')

		new Promise(async (resolve, reject)=>{
			index = await RecursivelyBuildIndex("./build/upstream/", "/")
			index.root = true
			resolve()
		}).then(()=>{new Promise((resolve, reject)=>{
			gulp.src(["./build/upstream/**/*.md","./build/upstream/examples/**/*.md"])
			.pipe(markdown.default())
			.pipe(tap((file)=>{
				file.contents = Buffer(siteFunction({
					markdown: file.contents.toString(), 
					fileName: file.basename,
					filePath: file.relative,
					index: index
				}))
			}))
			.pipe(gulp.dest('./docs')).on('finish', ()=>{
				resolve()
			})
		})}).then(cb)
	})
}


async function RecursivelyBuildIndex(thisFolder, offset){
	let folders = await (await fs.readdir(thisFolder, {withFileTypes: true})).filter((f)=>{return f.isDirectory()})
	let files = await (await fs.readdir(thisFolder, {withFileTypes: true})).filter((f)=>{return !f.isDirectory()})
	let index = {
		files: [],
		folders: [],
		name: path.basename(thisFolder)
	}
	for (const file of files) {
		if(!file.name.endsWith(".md")){
			continue
		}
		index.files.push({
			name: file.name,
			path: path.join(offset, file.name)
		})
	}
	for (const folder of folders) {
		if(folder.name.startsWith(".")){
			continue
		}
		let addition = await RecursivelyBuildIndex(path.join(thisFolder, folder.name), path.join(offset, folder.name))
		if(addition.files.length < 1 && addition.folders.length < 1){
			continue
		}
		index.folders.push(addition)
	}
	return index
}

function copy_static() {
	return gulp.src('./static/**').pipe(gulp.dest('./docs'))
}

function copy_images() {
	return gulp.src('./build/upstream/assets/**').pipe(gulp.dest('./docs/assets/'))
}

exports.default = gulp.series(clean, clone_docs, gulp.parallel(build_docs, copy_static, copy_images))
exports.clean = clean
exports.clone_docs = clone_docs
exports.build_docs = build_docs
exports.copy_static = copy_static


var watchtask = function(done) {
	gulp.watch(['static/**','site.pug','menu.pug'],{}, gulp.parallel(build_docs, copy_static))
	console.log("Now running watch. Quit node to stop.")
	done()
}
watchtask.displayName = "launch watch service"
exports.watch = gulp.series(exports.default, watchtask)