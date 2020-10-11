import { SetType, ModelType } from './types'
import { arrify, dump, parseIdx } from './util'
import Record from './record'
import Future from './future'
import { identity } from 'lodash'

/**
 * Spawn a new entity which is part of a set.
 * 
 * @param {typeof ModelType} Type - model type
 * @param {Array<string|number>} alias - entity alias
 * @return {ModelType} spawned entity
 */
function spawnEntity(Type, ...alias) {

	// Get i-th entity
	let entity = Type.get(...alias)

	// Subscribe to delete event
	entity._wait('delete').then(() => {

		// Find entity index in set
		const key = Type.key(alias)
		const idx = this.__indices__.findIndex((other) => Type.key(other) === key)

		// If found, remove from set
		if (idx !== -1) this.__indices__.splice(idx, 1)
	})

	// Return entity
	return entity
}

/**
 * Returns a set factory bound to a context.
 * 
 * @param {typeof ModelType} Type - model type
 * @returns {typeof Set} set factory
 */
export default function(Type) {

	// Get context
	const { request, store, Model } = this
	const isFutureMode = () => this._futureMode

	/**
	 * Base class for set types.
	 */
	const Set = class extends SetType
	{
		/**
		 * Create a new set from a set of indices.
		 * 
		 * @param {Array} indices - list of entity indices
		 * @param {Record} [record] - store record 
		 * @param {ModelType} [owner] - entity this set belongs to
		 */
		constructor(indices, record, owner)
		{
			return new Proxy(super(), {
				/**
				 * Getter trap method. If prop is index returns
				 * i-th entity, otherwise return member or
				 * slice of properties.
				 */
				get(target, prop, self)
				{
					if (isFutureMode())
					{
						// Return future
						return Future((async () => (await record.wait('ready'), self[prop]))())
					}

					switch (prop)
					{
						// Returns request method
						case '__request__': return request

						// Returns list of indices
						case '__indices__': return indices

						// Returns set record, if any
						case '__record__': return record

						// Returns entity this set belongs to, if any
						case '__owner__': return owner
						
						default:
							// Try to parse number
							let idx = typeof prop === 'symbol' ? NaN : parseIdx(prop)

							if (Number.isNaN(idx))
							{
								if (Reflect.has(target, prop))
								{
									return Reflect.get(...arguments)
								}
								else
								{
									// TODO: Return array of props
								}
							}
							else return spawnEntity.bind(self, Type)(...arrify(this.__indices__[idx]))
					}
				}
			})
		}

		/**
		 * Length of the set.
		 * 
		 * @type number
		 */
		get _length()
		{
			return this.__indices__.length
		}
		
		/**
		 * Array representation. Can be used in place of spread with {@link Pony#wait}.
		 * 
		 * @type Array
		 */
		get _array()
		{
			return Array.from(this)
		}

		/**
		 * Returns iterator over entities.
		 */
		*[Symbol.iterator]() {

			// Yield entities
			for (let pk of this.__indices__) yield spawnEntity.bind(this, Type)(...arrify(pk))
		}

		/**
		 * Map entities, return mapped array (not set!).
		 * 
		 * @param {function} mapping - map function
		 * @returns {Array} mapped array of entities
		 */
		_map(mapping)
		{
			return Array.from(this, mapping)
		}

		/**
		 * Creates a new instance of the given model and
		 * inserts it in the set.
		 * 
		 * @param {Object} params - creation parameters
		 * @param {string} [uri] - create URI if different from default
		 * @returns {ModelType} created entity
		 */
		_create(params, uri)
		{
			// Use model creation method
			if (!uri && this.__owner__) uri = this.__owner__._uri('/' + Type.index)
			let entity = Type.create(params, uri)

			// TODO: Add fake entry to set
			
			// We cannot add the entity pk right away
			entity._wait('ready').then((readyEntity) => this.__indices__.push(readyEntity._pk))

			// Return created entity meanwhile
			return entity
		}

		/**
		 * Return a promise that resolves on record event.
		 * 
		 * @param {string} [event = 'update'] - record event
		 * @param {function} [what] - transform callback
		 * @returns {Promise} set or transform callback output
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
		 * Fetches a set of entities from the given endpoint.
		 * 
		 * @param {string} uri - endpoint URI
		 * @param {ModelType} [owner] - entity this set belongs to, if any
		 * @returns {Set} set of entities
		 */
		static fetch(uri, owner)
		{
			// Get record or create new one
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record.data, record, owner)

			// Update record if necessary
			record.maybeUpdate(() => record.fromRequest(request('GET', uri)))

			return set
		}

		/**
		 * Returns the entire set of entities.
		 * 
		 * @param {string} uri - optional URI
		 * @returns {Set} set of entities
		 */
		static all(uri)
		{
			return this.fetch(uri || Type.uri())
		}

		/**
		 * Returns a set of entities associated to given entity.
		 * 
		 * @param {ModelType} entity - entity this set belongs to
		 * @return {Set} set of entities in this entity
		 */
		static in(entity)
		{
			// Fetch at uri
			return this.fetch(entity._uri('/' + Type.index), entity)
		}

		/**
		 * Perform a search, returns results.
		 * 
		 * @param {Object} query - query object
		 * @param {string} [uri] - search URI if different from default
		 * @returns {Set} set of result
		 */
		static async search(query, uri)
		{
			// Get search URI
			uri = uri || Type.uri([], '/search')

			// Get data from request
			let [ data ] = await request('GET', uri, dump(query))()

			// Return set of results
			return new this(data)
		}
	}

	return Set
}