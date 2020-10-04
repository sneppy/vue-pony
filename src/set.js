import { SetType, ModelType } from './types'
import { arrify, parseIdx } from './util'
import Record from './record'

export default function(Type) {

	// Get context
	const { request, store, Model } = this

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
							else
							{
								// Return i-th entity
								return Type.get(...arrify(indices[idx]))
							}
					}
				}
			})
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
			record.maybeUpdate(async () => {
				
				// Update record from request
				record.fromRequest(request('GET', uri))
			})

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