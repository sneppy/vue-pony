import path from 'path'
import babel from '@rollup/plugin-babel'
import pkg from './package.json'

export default {
	input: path.resolve(__dirname, 'src/index.js'),
	output: [
		{
			file: path.resolve(__dirname, pkg.main),
			format: 'cjs',
			exports: 'default'
		},
		{
			file: path.resolve(__dirname, pkg.module),
			format: 'esm',
			exports: 'default'
		}
	],
	plugins: [
		babel({
			babelHelpers: 'runtime'
		})
	],
	external: [
		'crypto',
		'vue',
		'lodash'
	]
}