module.exports = {
	env: {
		development: {
			presets: [
				'@vue/cli-plugin-babel/preset'
			]
		},
		production: {
			presets: [
				'@babel/preset-env'
			],
			plugins: [
				'@babel/plugin-transform-runtime'
			]
		}
	}
}