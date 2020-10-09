import { Mutex } from 'async-mutex'
import { dearrify } from './util'
import request from './request'
import Store from './store'
import Model from './model'
import Set from './set'

/**
 * Represents an external API service.
 */
export default class Pony
{
	/**
	 * Creates a new instance of Pony.
	 * @param {Object} options - set of API options
	 * @param {URL|string} options.base - API base URL
	 * @param {AuthorizeRequest} [options.authorize] - authorization callback
	 */
	constructor({ base, authorize = null } = {})
	{
		/**
		 * Request method bound to this API.
		 */
		this.request = request.bind(this, base)
		
		/**
		 * Authorize callback
		 */
		this.authorize = authorize

		/**
		 * Store with fetched data.
		 */
		this.store = Store()

		/**
		 * Future mode flag.
		 * @type boolean
		 */
		this._futureMode = false

		/**
		 * General purpose mutex.
		 */
		this._lock = new Mutex
	}

	/**
	 * Model class associated to this Pony instance.
	 * @type {typeof Model}
	 */
	get Model()
	{
		return Model.apply(this)
	}

	/**
	 * Set class associated to this Pony instance.
	 * @type {typeof Set}
	 */
	get Set()
	{
		return Set.bind(this)
	}

	/**
	 * Evaluate expression forcing models to return Futures.
	 * @param {...function} exprs - expressions to evaluate
	 * @returns {Promise} expression promise
	 */
	async _withFutureMode(...exprs)
	{
		// Lock
		const release = await this._lock.acquire()

		// Evaluate expression in future mode
		this._futureMode = true
		let results = exprs.map((expr) => expr()) // TODO: Can we pass something useful as param?
		this._futureMode = false

		// Release lock
		release()

		return await Promise.all(results)
	}
	
	/**
	 * Wait for expressions to resolve.
	 * @param  {...function} exprs - zero or more expressions
	 * @returns {*} single result or array of results
	 */
	wait(...exprs)
	{
		return new Promise(async (resolve, reject) => {

			// Evaluate expressions
			let results = this._withFutureMode(...exprs)
			
			try
			{
				// Resolve with expression result
				resolve(dearrify(await results))
			}
			catch (err)
			{
				// Handle error
				reject(err)
			}
		})
	}
}

/**
 * Callback used to authorize a request
 * @callback AuthorizeRequest
 * @param {XMLHttpRequest} xhr the xhr request that must be authorized
 */
