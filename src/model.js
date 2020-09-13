import { isEmpty, isFunction, identity } from "lodash"
import { arrify } from './utils'
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
export default function Model() {

	// Get context request
	const { Set, request, store } = this
	const shouldWait = () => !!this._fetchMode // TODO: Replace

	/**
	 * 
	 */
	return class Model extends ModelType
	{
		/**
		 * 
		 */
		constructor(data, record = null)
		{
			// Returns a custom proxied object
			return new Proxy(super(data), {
				/**
				 * 
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

							// TODO: Bypass Promise prototype
							if (prop === 'then') return target.then.bind(target)

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
					const wait = async (then = identity) => (await record.waitReady(), then(receiver))

					// Return wait method
					if (prop === '_wait' && !!record && record instanceof Record) return wait

					// Wait for record to be ready, return Promise
					if (shouldWait()) return wrap(wait((self) => self[prop]))
					
					// Get model prop...
					if (prop === '_self')
					{
						// Return self
						return receiver
					}
					
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
							return set.get(receiver)
						}
						else
							; // * Skip to access other properties
					}

					if (!isEmpty(target._data) && prop in target._data)
					{
						// Return property from model data
						return target._data[prop]
					}
					
					return Reflect.get(...arguments)
				},

				/**
				 * 
				 */
				set(target, prop, value, receiver) {

					// TODO: Writing of relationships?
					
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
		async _wait()
		{
			return this // Overriden if record present
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
			const uri = this.uri(alias)

			// Get from store
			let record = store.get(uri) || store.set(uri, new Record)
			let model = new this(record._data, record)

			if (isEmpty(alias.join()))
			{
				record.syncUpdate(() => {})
			}
			else
			{
				// If necessary, update record
				record.maybeUpdate(async () => {

					// Fetch data and update record
					Object.assign(record._data, await request('GET', uri)())

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
		static fetch(...alias)
		{
			return this.get(...alias)._wait()
		}
	}
}