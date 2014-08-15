module.exports = function(grunt){
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			css_common: {
				src: [
					'client/public/src/css/main.css'
				],
				dest: 'client/public/generated/app.<%= pkg.version %>.css'
			},
			js_common: {
				options: {
					separator: ';',
					stripBanners: true,
					process: function(src, filepath){
						return src.replace(/("|')use strict\1;?/g, '');
					}
				},
				src: [
					'client/public/src/vendor/moment/**/*.js',
					'client/public/src/vendor/**/*.js',
					'client/public/src/js/main.js'
				],
				dest: 'client/public/generated/app.<%= pkg.version %>.js'
			}
		},
		uglify: {
			js_common: {
				files: {
					'client/public/dist/js/app.<%= pkg.version %>.min.js': [
						'client/public/generated/app.<%= pkg.version %>.js'
					]
				}
			}
		},
		cssmin: {
			css_common: {
				options: {
					keepSpecialComments: 0
				},
				files: {
					'client/public/dist/css/app.<%= pkg.version %>.min.css': [
						'client/public/generated/app.<%= pkg.version %>.css'
					]
				}
			}
		},
		clean: {
			files: {
				src: [
					'client/public/generated',
					'client/public/dist/**/*.**',
					'!client/public/dist/**/app.<%= pkg.version %>.*'
				]
			}
		},
		watch: {
			scripts: {
				files: [
					'package.json',
					'client/public/src/vendor/**/*.*',
					'client/public/src/js/*.js',
					'client/public/src/css/*.css'
				],
				tasks: [
					'default'
				],
				options: {
					spawn: false
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', [
		'concat:js_common',
		'concat:css_common',
		'uglify:js_common',
		'cssmin:css_common',
		'clean:files'
	]);
};