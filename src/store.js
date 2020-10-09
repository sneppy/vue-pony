import { createHash } from 'crypto'

// Vue reactive function
let reactive

try
{
	// If Vue is a dependency, import `reactive`
	reactive = require('vue').reactive
}
catch (err)
{
	// Inform that Vue is not a dependency
	console.warn(err)
}

/**
 * Hashes the given key.
 * @param {string} key - record key
 * @returns {string} hashed key
 */
const defaultHashFn = (key) => createHash('md5').update(key).digest('hex')

/**
 * Returns a new instance of a store.
 * @param {Object} [options={}] - store options
 * @param {boolean} [options.reactive=true] - if true store will be reactive
 * @param {KeyHashFunction} [options.hash=defaultHashFn] - function that hashes record keys
 */
export default function Store(options = {}) {

	// Get options
	const { hash = defaultHashFn, reactive: makeReactive = true } = options

	// Reactive store
	let store = makeReactive && reactive ? reactive({}) : {}

	/**
	 * Returns record identified by key or `undefined` if not found.
	 * @param {*} key - record key
	 * @returns record identified by key
	 */
	const get = (key) => {

		let h = hash(key)
		return store[h]
	}

	/**
	 * Stores record identified by key and returns value.
	 * @param {*} key - record key
	 * @param {*} val - record value
	 * @returns stored value
	 */
	const set = (key, val) => {

		let h = hash(key)

		// Set record and return reactive copy
		store[h] = val
		return store[h]
	}

	/**
	 * Reset a set of records identified by keys, or all records.
	 * @param  {...*} keys - list of keys to reset
	 */
	const reset = (...keys) => {

		if (keys.length === 0)
		{
			// Reset all records
			for (let key in store) delete store[key]
		}
		else keys.forEach((key) => {

			let h = hash(key)

			// Pop value from store
			delete store[h]
		})
	}

	/**
	 * Creates an alias to a given record.
	 * @param {*} alias - alias key
	 * @param {*} key - record key
	 * @param {*} [val] - optional record value
	 * @returns record value
	 */
	const alias = (alias, key, val) => {

		let h = hash(alias)
		let g = hash(key)

		// If val is specified, set value for key
		if (val !== undefined) store[g] = val

		// Store alias and return reactive copy
		return (store[h] = store[g])
	}

	/**
	 * Returns true if store has record identified by key.
	 * @param {*} key - record key
	 * @returns {boolean} true if record exists
	 */
	const has = (key) => {

		return (hash(key) in store)
	}

	return { get, set, reset, alias, has }
}

/**
 * @callback KeyHashFunction
 * @param {*} key - record key
 * @returns {string} hashed key
 */