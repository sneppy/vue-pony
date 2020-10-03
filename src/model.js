import { isEmpty, isFunction, isArray, isObject, identity } from "lodash"
import { arrify, dearrify } from './utils'
import { isSet } from "./set"
import Record from './record'

/**
 * 
 */
export class ModelType
{
	/**
	 * 
	 */
	constructor(data)
	{
		this._data = data
	}
}

/**
 *
 */
export const isModel = (obj) => obj instanceof ModelType

/**
 *
 */
export const transformParams = (p) => {

	if (isModel(p))
	{
		// Return primary key
		return dearrify(p._pk)
	}
	else if (isSet(p))
	{
		// Return array of indices
		return [ ...p._indices ]
	}
	else if (isArray(p))
	{
		return p.map(transformParams)
	}
	else if (isObject(p))
	{
		// Create copy
		let obj = { ...p }

		// Apply on object properties
		for (let key in obj) obj[key] = transformParams(obj[key])

		// Return new object
		return obj
	}
	else return p
}

/**
 * 
 */
export default function Model() {

	// Get context request
	const { Set, request, store } = this

	/**
	 * Returns true if we should fetch
	 * and wait the model. Forces getter
	 * to return a proxied promise rather
	 * than the property itself.
	 */
	const shouldFetch = () => !!this._fetchMode // TODO: Replace

	/**
	 * 
	 */
	return class Model extends ModelType
	{
		/**
		 * Construct a new entity from this Model
		 *
		 * @param {Object} data entity raw data
		 * @param {Record} record record associated to this entity, if any
		 */
		constructor(data, record)
		{
			// Returns a custom proxied object
			return new Proxy(super(data), {
				/**
				 * Proxy getter.
				 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
				 *
				 * This proxy serves three purposes:
				 * - exposes properties of `_data` object;
				 * - handles entity-to-entity relationships
				 *	defined with static methods;
				 * - if fetch mode is enabled returns a
				 *	a proxied promise instead of the
				 *	property itself
				 */
				get(target, prop, receiver) {
					
					// Object prototype
					const proto = Object.getPrototypeOf(target)

					/**
					* This function wraps the return
					* value of the model getter in a
					* proxy. The return value is a
					* promise, and the proxy generates
					* a nested promise which eventually
					* yields the requested prop.
					*/
					const wrap = (future) => new Proxy(future/* This is a Promise */, {
						/**
						 *
						 */
						get(target, prop, receiver) {
							
							// Bypass Promise prototype
							if (prop in Promise.prototype)
							{
								const val = Reflect.get(...arguments)

								// * Necessary for `Promise.then` and similar
								return isFunction(val) ? val.bind(target) : val
							}

							// TODO: May cause problems with nested objects (e.g. `adventure.settings.roles`)
							// TODO: Handle `Set`
							return wrap((async () => {

								// Await future value
								let future = await target

								if (isModel(future) || isSet(future))
								{
									// Return future value of `model[prop]`
									return await future._wait((model) => model[prop])
								}
								// Return value as is
								else return future[prop]
							})())
						}
					})

					/**
					 *
					 */
					const del = () => {

						// Get deletion URI
						const uri = receiver._uri()

						// Delete record
						return record.asyncDelete(async () => {

							// Create and dispatch delete request
							let [ _, status ] = await request('DELETE', uri)()

							// After deletion, reset store
							store.reset(uri)
						})
					}

					/**
					 *
					 */
					const wait = async (then = identity) => (await record.waitReady(), then(receiver))

					// Switch on prop name
					switch (prop)
					{
						// Returns delete method
						case '_delete': if (record instanceof Record) return del; break // Returns undefined

						// Returns wait method
						case '_wait': if (record instanceof Record) return wait; break // Returns undefined

						// Returns method to register delete callback
						// TODO: What about having `_on` with string events?
						case '_onDelete': if (record instanceof Record) return record.onDelete.bind(record); break // Returns undefined

						// Returns the record status
						case '_status': return (record instanceof Record) && record._status

						// Returns true if request is done
						case '_ready': return (record instanceof Record) && record._status !== 0

						// Returns true if request was 200 OK or 201 CREATED
						case '_ok': case '_found': return (record instanceof Record) && (record._status === 200 || record._status === 201)

						// Returns true if an error occured, i.e. status is 4XX or 5XX
						case '_error': return (record instanceof Record) && record._status > 299

						// Resets record status, invalidates data but doesn't actually delete it
						case '_invalidate': if (record instanceof Record) return record.invalidate.bind(record); break // Returns undefined

						default:
							// If in fetch mode, wait self and wrap property
							if (shouldFetch())
							{
								return wrap(wait((self) => self[prop]))
							}
							else
							{
								if (prop in proto.constructor)
								{
									if (isModel(proto.constructor[prop].prototype))
									{
										// Get model prototype and mapping
										const matrix = proto.constructor[prop]
										const { mapping = prop } = matrix
										
										// Get alias
										const alias = isFunction(mapping) ? mapping(receiver) : target._data[mapping]
			
										// Return model from cache if any
										return matrix.get(...arrify(alias))
									}
									else if (isSet(proto.constructor[prop].prototype))
									{
										// Get set prototype
										const set = proto.constructor[prop]
			
										// Return set from cache if any
										return set.in(receiver)
									}
									else
										; // * Skip to access other properties
								}

								if (!isEmpty(target._data) && prop in target._data)
								{
									// Return property from model data
									return target._data[prop]
								}
								// Otherwise return class property
								else return Reflect.get(...arguments)
							}
					}
				},

				/**
				 * 
				 */
				set(target, prop, value, receiver) {
					
					// Object prototype
					const proto = Object.getPrototypeOf(target)

					// TODO: Writing of relationships?
					if (prop in proto.constructor)
					{
						if (isModel(proto.constructor[prop].prototype))
						{
							// TODO: Handle model writing, mapping must be reviewed							
							return false
						}
						else if (isSet(proto.constructor[prop].prototype))
						{
							// TODO: Handle set writing
							return false
						}
						else
							; // * Skip to write other properties
					}
					
					if (!isEmpty(target._data) && prop in target._data)
					{
						target._data[prop] = value
						return true
					}
					// Prevent writing of other properties
					else return false
				}
			})
		}

		/**
		 * Returns reference to self
		 *
		 * @returns {ModelType} ref to self
		 */
		get _self()
		{
			return this
		}

		/**
		 * 
		 */
		get _pk()
		{
			// Return `id` property by default
			return arrify(this.id)
		}

		/**
		 * 
		 */
		_index()
		{
			return Object.getPrototypeOf(this).constructor.index()
		}

		/**
		 * 
		 */
		_key()
		{
			return Object.getPrototypeOf(this).constructor.key(this._pk)
		}

		/**
		 * 
		 */
		_uri(path = '')
		{
			return Object.getPrototypeOf(this).constructor.uri(this._pk, path)
		}

		/**
		 * 
		 */
		_equals(other)
		{
			return !!this._data && this._data === other._data
		}

		/**
		 *
		 */
		async _wait()
		{
			return this // Overriden if record present
		}

		/**
		 * 
		 */
		async _delete()
		{
			// Get delete URI
			const uri = this._uri()

			// Create and dispatch request
			let [ _, status ] = await request('DELETE', uri)()

			// TODO: Reset record

			// TODO: Remove from set
		}

		/**
		 * 
		 */
		static index()
		{
			return this.name.toLowerCase()
		}

		/**
		 * 
		 */
		static key(alias = [])
		{
			return [this.index(), arrify(alias).join(',')].join('.')
		}

		/**
		 * 
		 */
		static uri(alias = [], path = '')
		{
			return ['', this.index(), ...arrify(alias)].join('/') + path
		}

		/**
		 * 
		 */
		static get(...alias)
		{
			if (alias.length === 0) return Set(this).all()

			// Get object key and URI
			const uri = this.uri(transformParams(alias))

			// Get from store
			let record = store.get(uri) || store.set(uri, new Record)
			let model = new this(record._data, record)

			if (alias.some((key) => key === undefined)) // TODO: Test this
			{
				// Set status to not found
				record.syncUpdate(() => record._status = 404)
			}
			else
			{
				// If necessary, update record
				record.maybeUpdate(async () => {

					// Fetch data and update record
					record.fromRequest(await request('GET', uri)())

					// Get URI from primary key
					const pkuri = this.uri(model._pk)

					// If key is not primary key, set alias
					if (uri !== pkuri) store.alias(uri, pkuri, record)
				})
			}
			
			return model
		}

		/**
		 * 
		 */
		static fetch(uri)
		{
			let record = store.get(uri) || store.set(uri, new Record)
			let entity = new this(record._data, record)

			record.maybeUpdate(async () => {

				// Fetch data and update record
				record.fromRequest(await request('GET', uri)())

				// Get actual entity URI
				const pkuri = this.uri(entity._pk)

				// Store alias if different from fetch URI
				if (uri !== pkuri) store.alias(uri, pkuri, record)
			})

			return entity
		}

		/**
		 * 
		 */
		static search(query)
		{
			return Set(this).search(query)
		}

		/**
		 *
		 */
		static create(params)
		{
			// Get create URI
			const uri = this.uri([])

			// Create record and model
			let record = new Record({})
			let entity = new this(record._data, record)

			record.asyncUpdate(async () => {

				// Create and dispatch create request, update record
				record.fromRequest(await request('POST', uri)(transformParams(params)))

				// Evaluate primary key
				const pkuri = this.uri(entity._pk)

				// Store record
				store.set(pkuri, record)
			})

			// TODO: I was here
			return entity
		}

		/**
		 *
		 */
		static reset(...alias)
		{
			if (alias.length === 0) ; // TODO: Reset set

			// Transform alias
			alias = alias.reduce((alias, key) => alias.concat(isModel(key) ? key._pk : key), [])

			// Get object URI
			const uri = this.uri(alias)

			// Try to get record from store and reset
			let record = store.get(uri)
			if (record !== undefined) record.reset()
		}
	}
}