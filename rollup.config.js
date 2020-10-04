import path from 'path'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json'

export default {
	input: path.resolve(__dirname, 'src/index.js'),
	output: [
		{
			file: path.resolve(__dirname, pkg.main),
			format: 'cjs',
			exports: 'default',
			plugins: [terser()]
		},
		{
			file: path.resolve(__dirname, pkg.module),
			format: 'esm',
			exports: 'default',
			plugins: [terser()]
		}
	],
	plugins: [
		// Enable babel
		babel({
			babelHelpers: 'runtime'
		})
	],
	external: [
		/@babel\/runtime/,
		'crypto',
		'vue',
		'lodash',
		'async-mutex',
		'uuid'
	]
}