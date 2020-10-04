import request from "./request"
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
}

/**
 * Callback used to authorize a request
 * @callback AuthorizeRequest
 * @param {XMLHttpRequest} xhr the xhr request that must be authorized
 */
