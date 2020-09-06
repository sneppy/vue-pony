import { createHash } from 'crypto'
import { reactive } from 'vue'

/**
 * 
 */
export default function Store(options = {}) {

	// Get options
	const { hash = ((key) => '' + key) } = options

	// Reactive store
	// TODO: Make reactive
	let store = reactive({})

	window.store = store

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
	const reset = (key) => {

		let h = hash(key)

		// Pop value
		let val = store[h]
		delete store[h]

		return val
	}

	/**
	 * 
	 */
	const alias = (alias, key, val) => {

		let h = hash(alias)
		let g = hash(key)

		// If val is specified, set value for key
		if (val !== undefined) store[h] = val

		// Store alias and return reactive copy
		return (store[g] = store[h])
	}

	/**
	 * 
	 */
	const has = (key) => {

		return (hash(key) in store)
	}

	return { get, set, reset, alias, has }
}