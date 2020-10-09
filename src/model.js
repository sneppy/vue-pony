import { identity } from 'lodash';
import { arrify, dump } from './util'
import { isModel, isSet, ModelType } from './types';
import Record from './record'
import Future from './future'

/**
 * Returns a model class bound to a context.
 * @returns {typeof Model} model class
 */
export default function() {

	// Get context
	const { request, store, Set } = this
	const isFutureMode = () => this._futureMode
	
	/**
	 * Base implementation class for all models.
	 * @extends ModelType
	 */
	const Model = class extends ModelType
	{
		/**
		 * Create a new model instance (entity).
		 * @param {Object?} data - entity data
		 * @param {Record} [record] - entity record
		 */
		constructor(data, record)
		{
			return new Proxy(super(), {
				/**
				 * Getter trap method.
				 * @param {Object} target - target object
				 * @param {number|string|Symbol} prop - property name
				 * @param {Proxy} self - proxy object
				 * @returns {*}
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
				 * Setter trap method.
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

					if (Reflect.has(data, prop))
					{
						if (true)
						{
							// Set data property
							data[prop] = value
							return true
						}
						else return false // TODO: Add readonly prop? Like `id`?
					}

					return Reflect.set(...arguments)
				}
			})
		}

		/**
		 * Entity primary key.
		 * @type Array
		 */
		get _pk()
		{
			return arrify(this.id)
		}

		/**
		 * Entity textual key, can be used to key DOM elements.
		 * @type string
		 */
		get _key()
		{
			return this.__type__.index + ':' + this._pk.join('.')
		}

		/**
		 * Record status if any
		 * @type number
		 */
		get _status()
		{
			// Return record status
			return this.__record__.status
		}

		/**
		 * Returns entity primary URI.
		 * @param {string} path - path appended to URI
		 * @returns {string} primary URI
		 */
		_uri(path = '')
		{
			return this.__type__.uri(this._pk, path)
		}

		/**
		 * Updates the entity, fetching data from server.
		 * @param {boolean} [force=false] - forces update
		 * @returns {this} self
		 */
		_update(force = false)
		{
			if (this.__record__)
			{
				// Get fetch URI
				const uri = this._uri()
				
				/**
				 * Do update function
				 */
				const doUpdate = (fromRequest) => fromRequest(request('GET', uri))

				// If force update don't check expired
				if (force) this.__record__.asyncUpdate(doUpdate)
				else this.__record__.maybeUpdate(doUpdate)
			}

			return this
		}

		/**
		 * Delete entities.
		 * @param {string} uri - custom delete URI
		 * @returns {Promise} delete request promise
		 */
		async _delete(uri)
		{
			if (this.__record__)
			{
				// Get delete URI
				uri = uri || this._uri()

				// Send delete request and delete record
				this.__record__.asyncDelete((fromRequest) => fromRequest(request('DELETE', uri)))
			}
		}

		/**
		 * Updates server data with a PUT request (sends complete entity data).
		 * @param {Object} [data={}] - object with additional data, merged with entity data
		 * @param {string} [uri] - URI string if different from entity URI
		 * @returns {Promise<this>} promise that resolves with self
		 */
		async _put(data = {}, uri)
		{
			if (this.__record__)
			{
				// Merge data locally first
				const params = this.__record__.merge(data)

				// Get put URI
				const uri = this._uri()

				// Perform PUT request
				await this.__record__.asyncUpdate((fromRequest) => fromRequest(request('PUT', uri), params))
			}
			
			return this
		}

		_track(doPatch)
		{
			// Use patch mode to keep track of changes to data
			if (this.__record__) this.__record__._withPatchMode(() => doPatch(this))
		}
		
		async _patch(doPatch, uri)
		{
			if (this.__record__)
			{
				// TODO: Do patch before patching				
			}

			return this
		}

		/**
		 * Return a promise that resolves on record event.
		 * @param {string} [event='update'] - record event
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
		 * Returns the URI that identifies the entity identified by alias.
		 * @param {Array} [alias=[]] - any set of values that identifies the entity
		 * @param {string} [path=''] - optional path appended to the uri
		 * @returns {string} entity URI
		 */
		static uri(alias = [], path = '')
		{
			return '/' + [this.index, ...alias].join('/') + path
		}

		/**
		 * Returns entity identified by uri
		 * @param {string} params fetch endpoint
		 * @return {this} entity identified by uri
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
		 * @param  {...any} alias - any set of values that identifies the entity
		 * @returns {this} model instance fetched from server
		 */
		static get(...alias)
		{
			return alias.length ? this.fetch(this.uri(dump(alias))) : Set(this).all()
		}

		/**
		 * Create a new entity.
		 * @param {Object} params - creation parameters
		 * @param {string?} uri - URI if different from default 
		 * @returns {this} created entity
		 */
		static create(params, uri)
		{
			// Get entity URI
			uri = uri || this.uri()

			// Create record
			let record = new Record(params)
			let entity = new this(record.data, record)

			// Async update record
			record.asyncUpdate(async (fromRequest) => {
				
				// Update record from request
				await fromRequest(request('POST', uri), dump(params))

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
