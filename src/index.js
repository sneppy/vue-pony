import { Mutex } from 'async-mutex'
import Model, { isModel } from './model'
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
		let { authorizer = null, base = '' } = options

		// Setup request method
		this.request = request.bind(this, base)

		// Create store
		// TODO: custom store
		this.store = Store()

		// Create authorizer
		this.authorizer = authorizer
		if (this.authorizer) this.authorize = this.authorizer.authorize.bind(authorizer)

		// Returns true if ... TODO
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
	_withFetchMode(expression)
	{
		// Evaluate fetch expression
		this._fetchMode = true
		let result = expression()
		this._fetchMode = false

		return result
	}

	/**
	 *
	 */
	wait(...expressions)
	{
		return new Promise(async (resolve, reject) => {

			// Let this code be executed by one worker.
			const release = await this._lock.acquire()
			
			// Evaluate expression
			let value = expressions.map(this._withFetchMode.bind(this))

			// Release lock
			release()

			// Now we can wait
			try
			{
				// Resolve promise with expression result
				resolve(dearrify(await Promise.all(value)))
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

	/**
	 * 
	 */
	check(...args)
	{
		if (this.authorizer) return this.authorizer.check(...args)
		else
		{
			console.log('No authorizer object defined on instance')
			return true
		}
	}
}

export { request, Model, Set, Required }