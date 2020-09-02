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
		this.authorize = authorizer && authorizer.authorize.bind(authorizer) || identity
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
}