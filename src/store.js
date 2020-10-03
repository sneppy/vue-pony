import { createHash } from 'crypto'
import { reactive } from 'vue'

/**
 *
 */
const defaultHashFn = (key) => createHash('md5').update(key).digest('hex')

/**
 * 
 */
export default function Store(options = {}) {

	// Get options
	const { hash = defaultHashFn } = options

	// Reactive store
	// TODO: Make reactive
	let store = reactive({})

	/**
	 * 
	 */
	const get = (key) => {

		let h = hash(key)
		return store[h]
	}

	/**
	 * 
	 */
	const set = (key, val) => {

		let h = hash(key)

		// Set record and return reactive copy
		store[h] = val
		return store[h]
	}

	/**
	 * 
	 */
	const reset = (...keys) => {

		if (keys.length === 0)
		{
			console.log('RESET', 'ALL')

			// Reset all records
			for (let key in store) delete store[key]
		}
		else keys.forEach((key) => {

			console.log('RESET', key)

			let h = hash(key)

			// Pop value from store
			delete store[h]
		})
	}

	/**
	 * 
	 */
	const alias = (alias, key, val) => {

		let h = hash(alias)
		let g = hash(key)

		// If val is specified, set value for key
		if (val !== undefined) store[g] = val

		// Store alias and return reactive copy
		store[h] = store[g]
		return store[h]
	}

	/**
	 * 
	 */
	const has = (key) => {

		return (hash(key) in store)
	}

	return { get, set, reset, alias, has }
}