import { arrify } from './utils'
import Record from "./record"

/**
 * 
 */
export class SetType
{
	/**
	 * 
	 */
	constructor(indices)
	{
		this._indices = indices
	}
}

/**
 *
 */
export const isSet = (obj) => obj instanceof SetType

/**
 * 
 */
export default function Set(matrix) {

	// Get context properties
	const { request, store } = this

	/**
	 * 
	 */
	return class Set extends SetType
	{
		/**
		 * 
		 */
		constructor(indices)
		{
			return new Proxy(super(indices), {
				/**
				 * 
				 */
				get(target, prop, receiver) {

					// Make iterable
					if (prop === Symbol.iterator)
					{
						return function*() {
							
							for (let idx = 0, len = target._indices.length || 0; idx < len; ++idx)
								// Yield `idx`-th model
								yield matrix.get(...arrify(target._indices[idx]))
						}
					}
					else if (false) // TODO: Allow to get model properties as arrays
						;
					else
					{
						try
						{
							// Parse prop as array index
							const idx = Number.parseInt(prop)
							if (Number.isNaN(idx)) throw TypeError('Expected number, got ' + prop)

							// Return `prop`-th model
							return matrix.get(...arrify(target._indices[idx]))
						}
						catch (err)
						{
							console.debug('Unexpected access', err)
							return Reflect.get(...arguments)
						}
					}
				},

				has(target, prop) {

					// For iterators
					return (prop === Symbol.iterator) || Reflect.has(...arguments)
				}
			})
		}

		/**
		 * 
		 */
		static all()
		{
			// Compute set key and uri
			const key = matrix.index()
			const uri = matrix.uri()

			// Get from cache or fetch from server
			let record = store.get(key) || store.set(key, new Record([]))
			record.maybeUpdate(async () => {

				let indices = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
			})

			return new this(record._data)
		}

		/**
		 * 
		 */
		static get(owner = null)
		{
			// Compute set key and uri
			const key = [matrix.index(), owner._index(), owner._pk.join(',')].join('.')
			const uri = owner._uri(matrix.uri())
			
			// Get from cache or fetch from server
			let record = store.get(key) || store.set(key, new Record([]))
			record.maybeUpdate(async () => {

				let indices = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
			})

			return new this(record._data)
		}
	}
}