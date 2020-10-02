import { arrify, dearrify, parseIdx } from './utils'
import Record from "./record"
import { isModel, transformParams } from './model'

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
export default function Set(Type) {

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
		constructor(indices, record = null, owner = null)
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
						{
							// Get alias
							const alias = target._indices[idx]

							// Get entity by alias
							let entity = Type.get(...arrify(alias))

							// TODO: Register delete callback
							/* entity._on('delete', () => {

								// TODO: Remove corresponding index
							}) */

							// Yield entity
							yield entity
						}
					}

					/**
					 * 
					 */
					const create = (params) => {

						if (!owner)
						{
							return Type.create(params)
						}
						else
						{
							// Get request URI
							const uri = owner._uri('/' + Type.index())
							
							// Create new record and entity
							let record = new Record({})
							let entity = new Type(record._data, record)

							// Update record asyncronously
							record.asyncUpdate(async () => {

								// Send create request
								record.fromRequest(await request('POST', uri)(transformParams(params)))

								// Evaluate actual entity uri
								const pkuri = Type.uri(entity._pk)

								// Store record
								store.set(pkuri, record)

								// TODO: Finally, local update indices and invalidate set record
							})

							return entity
						}
					}

					// TODO: In order to work inside `_withFetchMode` we should override iterator as well

					switch (prop)
					{
						// Returns wait method
						case '_wait': if (record instanceof Record) return wait // Otherwise, don't break

						// Returns create entity method
						case '_create': return create



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

									return Type.get(...arrify(target._indices[idx]))
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
			const uri = Type.uri()

			// Get from cache or fetch from server
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record._data, record)

			record.maybeUpdate(async () => {

				// Get items and udpate record status
				let [ indices ] = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
				record._status = status
			})

			return set
		}

		/**
		 * 
		 */
		static in(owner)
		{
			// Compute set key and uri
			const uri = owner._uri('/' + Type.index())
			
			// Get from cache or fetch from server
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record._data, record, owner)

			record.maybeUpdate(async () => {

				// Get items and update record
				let [ indices, status ] = await request('GET', uri)()
				record._data.splice(0, record._data.length, ...indices)
				record._status = status
			})

			return set
		}

		/**
		 * ? Use store or what? For now only async
		 */
		static async search(query)
		{
			// Search uri
			const uri = Type.uri([], '/search')

			// Transform query parameters
			let params = {}; for (let key in query)
			{
				const val = query[key]

				// If model, use primary key
				params[key] = isModel(val) ? val._pk.join(',') : val
			}
			
			// Return set with results
			const [ results ] = await request('GET', uri, params)()
			return new this(results)
		}
	}
}