import { isEmpty, isFunction } from "lodash"
import { arrify } from './utils'
import { SetType } from "./set"
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
export default function Model() {

	// Get context request
	const { request, store, Set } = this

	/**
	 * 
	 */
	return class Model extends ModelType
	{
		/**
		 * 
		 */
		constructor(data)
		{
			// Returns a custom proxied object
			return new Proxy(super(data), {
				/**
				 * 
				 */
				get(target, prop, receiver) {

					// Object prototype
					const proto = Object.getPrototypeOf(target)

					if (prop in proto.constructor)
					{
						if (proto.constructor[prop].prototype instanceof ModelType)
						{
							// Get model prototype and mapping
							const matrix = proto.constructor[prop]
							const { mapping = prop } = matrix
							
							// Get alias
							const alias = isFunction(mapping) ? mapping(receiver) : target._data[mapping]

							// Return model from cache if any
							return matrix.get(...arrify(alias))
						}
						else if (proto.constructor[prop].prototype instanceof SetType)
						{
							// Get set prototype
							const matrix = proto.constructor[prop]

							// Return set from cache if any
							return matrix.get(receiver)
						}
						else
							; // * Skip to access other properties
					}

					if (!isEmpty(target._data) && prop in target._data)
					{
						// Return property from model data
						return target._data[prop]
					}
					else return Reflect.get(...arguments)
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
			return [this.id]
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
			const key = this.key(alias)
			const uri = this.uri(alias)

			// Get from store and async update
			let record = store.get(key) || store.set(key, new Record)
			record.maybeUpdate(async () => {

				// Fetch data and update record
				Object.assign(record._data, await request('GET', uri)())

				// Get actual primary key
				const pk = this.key(new this(record._data)._pk)

				// If key is not primary key, set alias
				if (key !== pk) store.alias(key, pk, record)
			})

			return new this(record._data)
		}
	}
}