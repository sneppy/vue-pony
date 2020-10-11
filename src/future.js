import { isFunction } from 'lodash'
import { isModel, isSet } from './types'

/**
 * Wraps a promise in a Proxy that creates a new promise for accessed properties.
 * 
 * @param {Promise} future - promise that will resolve with future value
 * @returns {Proxy} proxied promise, a.k.a. future
 */
export default function Future(future) {

	// Return proxy around promise
	return new Proxy(future, {
		/**
		 * Future getter. If prop is in `Promise` prototype
		 * return as-is, otherwise resolve future and wrap
		 * it in another future container.
		 */
		get(target, prop, self) {

			if (Reflect.has(target, prop))
			{
				// Bypass Promise methods
				const val = Reflect.get(target, prop)

				// If function, bind for correct behaviour
				// @see https://stackoverflow.com/questions/30819290/how-to-proxy-a-promise-in-javascript-es6
				return isFunction(val) ? val.bind(target) : val
			}
			
			return Future((async () => {

				// Resolve future
				let now = await target

				if (isModel(now) || isSet(now))
				{
					// Wait for model to be ready, then get prop
					return await now._wait('ready', (futurable) => futurable[prop])
				}
				// Else immediately resolve with prop
				else return now[prop]
			})())
		},

		/**
		 * Trap for function call. First resolve promise
		 * and then calls the function.
		 */
		//! Unfortunately, per specs, `target` must be a callable object.
		//! Promises are not callable object, therefore this piece of
		//! code it's simply here because I hope this will change.
		apply(target, ctx, args) {
			
			return Future((async () => {

				// Resolve future
				let now = await target

				//? Check if is function?
				// Execute function
				return now.apply(ctx, args)
			})())
		}
	})
}