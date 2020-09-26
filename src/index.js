import { Mutex } from 'async-mutex'
import Model from './model'
import Set from './set'
import Required from './required'
import Store from './store'
import request from './request'
import { dearrify } from './utils'

/**
 * 
 */
export default class Pony
{
	/**
	 * 
	 */
	constructor(options = {})
	{
		let { authorize = null, base = '' } = options

		// Setup request method
		this.request = request.bind(this, base)

		// Create store
		this.store = Store()

		// Set authorize method
		this.authorize = authorize

		// When true, access to entity properties return promise
		this._fetchMode = false

		// Lock used for observer
		this._lock = new Mutex
	}

	/**
	 * 
	 */
	get Model()
	{
		return Model.bind(this)()
	}

	/**
	 * 
	 */
	get Set()
	{
		return Set.bind(this)
	}

	/**
	 * 
	 */
	get Required()
	{
		return Required.bind(this)
	}

	/**
	 *
	 */
	async _withFetchMode(expression)
	{
		// Lock mutex
		const release = await this._lock.acquire()

		// Evaluate fetch expression
		this._fetchMode = true
		let result = expression()
		this._fetchMode = false

		// Release lock
		release()

		return result
	}

	/**
	 *
	 */
	wait(...expressions)
	{
		return new Promise(async (resolve, reject) => {
			
			// Evaluate expressions
			let results = expressions.map(this._withFetchMode.bind(this))

			// Now we can wait
			try
			{
				// Resolve promise with expression result
				resolve(dearrify(await Promise.all(results)))
			}
			catch (err)
			{
				// Handle error
				reject(err)
			}
		})
	}

	/**
	 *
	 */
	resetStore()
	{
		// Reset all records
		this.store.reset()
	}
	
	/**
	 * Vue plugin installation
	 * 
	 * @param {Vue} app Vue instance
	 * @param {Object} options Plugin options
	 */
	static install(app, options)
	{
		// TODO
	}
}
