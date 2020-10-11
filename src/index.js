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
	 * @param {string} options.base - API base URL
	 * @param {AuthorizeRequest} [options.authorize] - authorization callback
	 */
	constructor({ base, authorize = null } = {})
	{
		/**
		 * Request factory bound to this API.
		 * 
		 * @type BoundRequest
		 */
		this.request = request.bind(this, base)
		
		/**
		 * Authorize callback. Executed to authorize
		 * outgoing requests.
		 * 
		 * @type AuthorizeRequest
		 */
		this.authorize = authorize

		/**
		 * Store with fetched data.
		 */
		this.store = Store()

		/**
		 * Future mode flag. When true forces property
		 * access on entities to return a promise.
		 * 
		 * @type boolean
		 * @private
		 */
		this._futureMode = false

		/**
		 * Lock used for future mode.
		 * 
		 * @type Mutex
		 * @private
		 */
		this._lock = new Mutex
	}

	/**
	 * Model class associated to this Pony instance.
	 * 
	 * @type {typeof Model}
	 */
	get Model()
	{
		return Model.apply(this)
	}

	/**
	 * Set class associated to this Pony instance.
	 * 
	 * @type {typeof Set}
	 */
	get Set()
	{
		return Set.bind(this)
	}

	/**
	 * Evaluates expression, forcing models to return promises
	 * instead of properties.
	 * 
	 * @param {...function} exprs - expressions to evaluate
	 * @returns {Promise} expression promise
	 * @private
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
	 * Waits for entities in expressions to be ready.
	 * 
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
 * Request method, bound to a given API instance. It
 * accepts the various {@link request} parameters,
 * except `base` which is bound to the API base URL.
 * It returns the dispatcher function.
 * 
 * @function BoundRequest
 * @param {string} method - request HTTP method
 * @param {string} uri - endpoint realtive URI
 * @param {Object} [params = {}] - URL query parameters (key: value)
 * @param {Object} [headers = {}] - HTTP headers map
 * @returns {function} dispatcher
 */

/**
 * Callback used to authorize a request. It receives the
 * XMLHttpRequest object as parameter, which it can modify
 * to authorize the outgoing request (e.g. by adding an
 * 'Authorization' header).
 * 
 * @callback AuthorizeRequest
 * @param {XMLHttpRequest} xhr the xhr request that must be authorized
 */
