import Model from './model'
import Set from './set'
import Required from './required'
import Store from './store'
import request from './request'

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
		let { authorizer = null, base = '' } = options

		// Setup request method
		this.request = request.bind(this, base)

		// Create store
		// TODO: custom store
		this.store = Store()

		// Create authorizer
		this.authorizer = authorizer
		if (this.authorizer) this.authorize = this.authorizer && this.authorizer.authorize.bind(authorizer)
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
	auth(...args)
	{
		// Use authorizer method if any
		if (this.authorizer) return this.authorizer.auth(...args)
		else
		{
			console.warn('No authorizer object defined on api instance')
			return true
		}
	}
}