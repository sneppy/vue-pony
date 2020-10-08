import { SetType, ModelType } from './types'
import { arrify, parseIdx } from './util'
import Record from './record'
import Future from './future'

/**
 * Spawn a new entity which is part of a set.
 * @param {typeof ModelType} Type - model type
 * @param {}
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
 * @param {typeof ModelType} Type - model type
 * @returns {function} set factory
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
		 * @param {Array} indices - list of entity indices
		 * @param {Record} [record] - store record 
		 */
		constructor(indices, record)
		{
			return new Proxy(super(), {
				/**
				 * Getter trap method.
				 * @param {Object} target - target object
				 * @param {number|string|Symbol} prop - property name
				 * @param {Proxy} self - proxy object
				 * @returns {*}
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
		 * Set length.
		 * @type number
		 */
		get _length()
		{
			return this.__indices__.length
		}
		
		/**
		 * Array representation. Can be used in place of spread with {@link Pony#wait}.
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

			for (let pk of this.__indices__)
			{
				// Fetch entity
				let entity = Type.get(...arrify(pk))

				// Yield entity
				yield entity
			}
		}

		/**
		 * Map entities, return mapped array (not set!).
		 * @param {function} mapping - map function
		 * @returns {Array} mappped array of entities
		 */
		_map(mapping)
		{
			return Array.from(this, mapping)
		}

		/**
		 * Return a promise that resolves on record event.
		 * @param {string} [event='update'] - record event
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
		 * Fetches a set of entity from the given endpoint.
		 * @param {string} uri - set URI
		 * @returns {this} set of entities
		 */
		static fetch(uri)
		{
			// Get record or create new one
			let record = store.get(uri) || store.set(uri, new Record([]))
			let set = new this(record.data, record)

			// Update record if necessary
			record.maybeUpdate(() => record.fromRequest(request('GET', uri)))

			return set
		}

		/**
		 * Returns a set of entities associated to given entity.
		 * @param {ModelType} entity - entity this set belongs to
		 * @return {this} set of entities in this entity
		 */
		static in(entity)
		{
			// Get set URI
			return this.fetch(entity._uri('/' + Type.index))
		}
	}

	return Set
}