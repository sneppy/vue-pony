import { identity } from 'lodash';
import { arrify, dump } from './util'
import { isModel, isSet, ModelType } from './types';
import Record from './record'
import Future from './future'

/**
 * Returns a model class bound to a given
 * API context. You should subclass this
 * class to define models.
 * 
 * @returns {typeof Model} model class
 */
export default function() {

	// Get context
	const { request, store, Set } = this
	const isFutureMode = () => this._futureMode
	
	/**
	 * Base implementation class for all models.
	 * 
	 * @extends ModelType
	 */
	const Model = class extends ModelType
	{
		/**
		 * Creates a new entity from given data.
		 * 
		 * @param {Object?} data - entity data
		 * @param {Record} [record] - optional entity record
		 */
		constructor(data, record)
		{
			return new Proxy(super(), {
				/**
				 * Getter trap method. If future method, returns
				 * future; if prop is static property and is
				 * either model or set, return relationships;
				 * if prop is not member of class, return from
				 * data.
				 */
				get(target, prop, self) {

					// Get model type
					const Type = target.constructor

					// Future mode
					if (isFutureMode())
					{
						// Return future, after record is ready
						return Future((async () => (await record.wait('ready'), self[prop]))())
					}
					
					switch (prop)
					{
						// Returns request function.
						// Can be called by derived
						// classes to perform requests
						// instead of relying on `api.request`
						case '__request__': return request

						// Returns entity raw data object
						case '__data__': return data

						// Returns associated record, if any
						case '__record__': return record

						// Returns model type
						case '__type__': return Type

						default:
							if (prop in Type)
							{
								// Check if prop is either a Model or a Set
								if (isModel(Type[prop].prototype))
								{
									// Get required type
									const RequiredType = Type[prop]

									// Return required entity
									return RequiredType.get(...arrify(data[prop]))
								}
								if (isSet(Type[prop].prototype))
								{
									// Get required type
									const RequiredType = Type[prop]

									// Return set of entities
									return RequiredType.in(self)
								}
								else; // Skip
							}

							// Return class members or data property
							// * This means that unlike in 1.x we can override model props
							return Reflect.has(target, prop) ? Reflect.get(...arguments) : data[prop]
					}
				},

				/**
				 * Setter trap method. Set data value; if
				 * prop is static property with value model,
				 * set value to entity primary key.
				 */
				set(target, prop, value, self) {

					// Get model type
					const Type = target.constructor

					if (prop in Type)
					{
						// Check if is model
						if (isModel(Type[prop].prototype))
						{
							// TODO: Handle model assignment
							return false
						}
					}

					// TODO: This kinda breaks the flow of the getter
					if (prop in data)
					{
						if (true)
						{
							// Set data property
							return (data[prop] = value, true)
						}
						else return false // TODO: Add readonly prop? Like `id`?
					}

					return Reflect.set(...arguments)
				}
			})
		}

		/**
		 * Entity primary key.
		 * 
		 * @type Array
		 */
		get _pk()
		{
			return arrify(this.id)
		}

		/**
		 * Entity textual key, can be used to key DOM elements.
		 * 
		 * @type string
		 */
		get _key()
		{
			return this.__type__.index + ':' + this._pk.join('.')
		}

		/**
		 * Record status, if record exists.
		 * 
		 * @type number
		 */
		get _status()
		{
			// Return record status
			return this.__record__.status
		}

		/**
		 * Returns entity primary URI.
		 * 
		 * @param {string} [path = ''] - path appended to URI
		 * @returns {string} entity URI
		 */
		_uri(path = '')
		{
			return this.__type__.uri(this._pk, path)
		}

		/**
		 * Updates the entity, fetching data from server.
		 * By default, fetch data only if current data
		 * is considered outdated.
		 * 
		 * @param {boolean} [force = false] - forces update
		 * @param {string} [uri] - optional URI, if different from entity URI
		 * @returns {this} self
		 */
		_update(force = false, uri)
		{
			if (this.__record__)
			{				
				/**
				 * Do update function
				 */
				const doUpdate = (fromRequest) => {
					
					return fromRequest(request('GET', uri || this._uri()))
				}

				force // If force update don't check expired
					? this.__record__.asyncUpdate(doUpdate)
					: this.__record__.maybeUpdate(doUpdate)
			}

			return this
		}

		/**
		 * Delete entity. Returns promise that resolves
		 * when delete request is fullfilled.
		 * 
		 * @param {string} [uri] - custom delete URI
		 * @returns {Promise} delete request promise
		 */
		async _delete(uri)
		{
			if (this.__record__)
			{
				// Send delete request and delete record
				await this.__record__.asyncDelete((fromRequest) => {
					
					// Update from request
					return fromRequest(request('DELETE', uri || this._uri()))
				})
			}
		}

		/**
		 * Updates server data with a PUT request (sends
		 * complete entity data). It returns a promise
		 * that resolves when PUT request is fullfilled.
		 * 
		 * @param {Object} [data = {}] - object with additional data, merged with entity data
		 * @param {string} [uri] - URI string if different from entity URI
		 * @returns {Promise<this>} promise that resolves with self
		 */
		async _put(data = {}, uri)
		{
			if (this.__record__)
			{
				// Merge entity data and provided data 
				const params = { ...this.__data__, ...data }

				// Send update request and update record
				await this.__record__.asyncUpdate((fromRequest) => {
					
					// Perform request
					return fromRequest(request('PUT', uri || this._uri()), params)
				})
			}
			
			return this
		}
		
		/**
		 * Execute patch function, tracking changes to data.
		 * Patch function is provided a patch callback to
		 * effectively patch the entity.
		 * If patch function is not provided, data is simply
		 * patched as-is.
		 * 
		 * @param {function} [doPatch] - patch function
		 * @param {string} [uri] - optional URI, if different from entity URI
		 * @returns {Promise<this>} promise that resolves with patched entity
		 */
		_patch(doPatch, uri)
		{
			return new Promise((resolve, reject) => {

				if (this.__record__)
				{
					/**
					 * Dispatches request, and resolves patch promise.
					 */
					const patch = () => {

						// TODO: Fetch patches from record
						const patches = this.__record__.patches

						// Do async update
						this.__record__.asyncUpdate((fromRequest) => {

							// Update from request
							return fromRequest(request('PATCH', uri || this._uri()), patches)
						})
							// Wait update and resolve
							.then(() => resolve(this))
							.catch((err) => reject(err))
					}

					if (doPatch)
					{
						// If patch function defined, execute patch function
						this.__record__.withPatchMode(() => doPatch(patch))
					}
					else
					{
						// If not patch function, just patch right away
						patch()
					}
				}
				// Ignore otherwise
				else resolve(this)
			})
		}

		/**
		 * Returns a promise that resolves on specified event.
		 * 
		 * @param {string} [event = 'update'] - record event
		 * @param {function} [what] - transform callback
		 * @returns {Promise} entity or transform callback output
		 */
		async _wait(event = 'update', what = identity)
		{
			if (this.__record__)
			{
				// Wait for event, then return whatever you wanted
				return (await this.__record__.wait(event), what(this))
			}
			// Immediately resolve promise
			else return what(this)
		}

		/**
		 * Model index, by default lowercase class name.
		 * @type {string}
		 */
		static get index()
		{
			return this.name.toLowerCase()
		}

		/**
		 * Returns the URI associated to the entity
		 * identified by alias.
		 * 
		 * @param {Array} [alias = []] - any set of values that identify the entity
		 * @param {string} [path = ''] - optional path appended to the uri
		 * @returns {string} entity URI
		 */
		static uri(alias = [], path = '')
		{
			return '/' + [this.index, ...alias].join('/') + path
		}

		/**
		 * Returns entity at URI.
		 * 
		 * @param {string} uri - fetch endpoint URI string
		 * @return {Model} entity identified by uri
		 */
		static fetch(uri)
		{
			// Create record
			let record = store.get(uri) || store.set(uri, new Record({}))
			let entity = new this(record.data, record)

			// Async update record
			record.maybeUpdate(async (fromRequest) => {

				// Update record from request
				await fromRequest(request('GET', uri))

				// Get entity's primary URI
				const pkuri = entity._uri()

				// If different from uri, create alias
				// TODO: This does not work as I intended to
				if (uri !== pkuri) store.alias(uri, pkuri, record)
			})

			// Return entity
			return entity
		}

		/**
		 * Returns entity identified by alias.
		 * 
		 * @param  {...any} alias - any set of values that identifies the entity
		 * @returns {Model} model instance fetched from server
		 */
		static get(...alias)
		{
			return alias.length ? this.fetch(this.uri(dump(alias))) : Set(this).all()
		}

		/**
		 * Creates a new entity. Send a POST request
		 * with the given parameters. Returns the created
		 * entity (before the request is fullfilled).
		 * 
		 * @param {Object} params - creation parameters
		 * @param {string?} uri - URI if different from default 
		 * @returns {this} created entity
		 */
		static create(params, uri)
		{
			// Create record
			let record = new Record(params)
			let entity = new this(record.data, record)

			// Async update record
			record.asyncUpdate(async (fromRequest) => {
				
				// Update record from request
				await fromRequest(request('POST', uri || this._uri()), dump(params))

				// Get entity's primary URI
				const pkuri = entity._uri()

				// Store record
				store.set(pkuri, record)
			})

			// Return created entity
			return entity
		}

		/**
		 * @see Set#search
		 */
		static search(query, uri)
		{
			return Set(this).search(query, uri)
		}
	}

	return Model
}
