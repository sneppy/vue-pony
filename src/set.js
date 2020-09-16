import { arrify, parseIdx } from './utils'
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
		constructor(indices, record = null)
		{
			return new Proxy(super(indices), {
				/**
				 * 
				 */
				get(target, prop, receiver) {

					/**
					 *
					 */
					const wait = async (then = identity) => (await record.waitReady(), then(receiver))

					/**
					 * 
					 */
					const iter = function*() {
							
						for (let idx = 0, len = target._indices.length || 0; idx < len; ++idx)
							// Yield `idx`-th model
							yield matrix.get(...arrify(target._indices[idx]))
					}

					// TODO: In order to work inside `_withFetchMode` we should override iterator as well

					switch (prop)
					{
						// Returns wait method
						case '_wait': if (record instanceof Record) return wait // Otherwise, don't break

						// Returns iterator
						case Symbol.iterator: return iter

						default:
							if (false)
								; // TODO: Allow to get model properties as arrays
							else
							{
								try
								{
									// Try parsing index and returning i-th model
									const idx = parseIdx(prop)

									return matrix.get(...arrify(target._indices[idx]))
								}
								catch (err)
								{
									if (prop in Array.prototype && !(prop in target))
									{
										// If prop is an Array property
										// create array from set and
										// get property (but not for
										// certain properties manually
										// defined like `length` or `map`)
										return Array.from(this)[prop]
									}
									else return Reflect.get(...arguments)
								}
							}
					}
				},

				/**
				 *
				 */
				has(target, prop) {

					// For iterable
					return (prop === Symbol.iterator) || Reflect.has(...arguments)
				}
			})
		}

		/**
		 * Returns reference to self
		 *
		 * @returns {SetType} ref to self
		 */
		get _self()
		{
			return this
		}

		/**
		 * 
		 */
		get length()
		{
			return this._indices.length
		}

		/**
		 * 
		 */
		map(mapping)
		{
			return Array.from(this, mapping)
		}

		/**
		 *
		 */
		forEach(callback)
		{
			for (let item of this) callback(item)
		}

		/**
		 * 
		 */
		static all()
		{
			// Compute set key and uri
			const uri = matrix.uri()

			// Get from cache or fetch from server
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record._data, record)

			record.maybeUpdate(async () => {

				let indices = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
			})

			return set
		}

		/**
		 * 
		 */
		static in(owner)
		{
			// Compute set key and uri
			const uri = owner._uri('/' + matrix.index())
			
			// Get from cache or fetch from server
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record._data, record)

			record.maybeUpdate(async () => {

				let indices = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
			})

			return set
		}

		/**
		 * ? Use store or what? For now only async
		 */
		static async search(query)
		{
			// Search uri
			const uri = matrix.uri([], '/search')
			
			// Return set with results
			return new this(await request('GET', uri, query)())
		}
	}
}