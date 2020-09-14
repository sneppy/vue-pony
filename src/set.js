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

					// Make iterable
					if (prop === Symbol.iterator) return iter
					
					// Returns wait method
					if (prop === '_wait' && !!record && record instanceof Record) return wait

					// Returns self, used to force property access
					if (prop === '_self') return receiver

					if (false) // TODO: Allow to get model properties as arrays
						;
					else
					{
						try
						{
							// Parse prop as array index
							// TODO: ['3.14'] returns 3 instead of NaN, and I don't like it
							const idx = Number.parseInt(prop)
							if (Number.isNaN(idx)) throw TypeError('Expected number, got ' + prop)

							// Return `prop`-th model
							return matrix.get(...arrify(target._indices[idx]))
						}
						catch (err)
						{
							if (prop in Array.prototype && !(prop in target))
							{
								// Create array from set and invoke method
								return Array.from(this)[prop]
							}
							else return Reflect.get(...arguments)
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
		get length()
		{
			return this._indices.length
		}

		/**
		 * 
		 */
		map(mapping)
		{
			return Array.from(this, mapping, this)
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
		 * ? Use store or what? For now only async
		 */
		static async search(query)
		{
			// Search uri
			const uri = matrix.uri([], '/search')
			
			// Return set with results
			return new this(await request('GET', uri, query)())
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
	}
}