import { identity, reject } from 'lodash';
import { arrify, dump } from './util'
import { isModel, isSet, ModelType } from "./types";
import Record from './record'

/**
 * Returns a model class bound to a context.
 * @returns {typeof Model} model class
 */
export default function() {

	// Get context
	const { request, store } = this
	
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
					let Type = target.constructor
					
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
			return `/${this.index}/${alias.join('/')}` + path
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
			record.maybeUpdate(async () => {

				// Update record from request
				await record.fromRequest(request('GET', uri))

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
			return this.fetch(this.uri(dump(alias)))
		}

		/**
		 * Create a new entity.
		 * @param {Object} params - creation parameters
		 * @returns {this} created entity
		 */
		static create(params)
		{
			// Get entity URI
			const uri = this.uri()

			// Create record
			let record = new Record(params)
			let entity = new this(record.data, record)

			// Async update record
			record.asyncUpdate(async () => {
				
				// Update record from request
				await record.fromRequest(request('POST', uri), dump(params))

				// Get entity's primary URI
				const pkuri = entity._uri()

				// Store record
				store.set(pkuri, record)
			})

			// Return created entity
			return entity
		}
	}

	return Model
}
