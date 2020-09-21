import { isFunction } from 'lodash'
import { markRaw } from 'vue'
import { Mutex } from 'async-mutex'
import { v4 as uuid } from 'uuid'
import { arrify } from './utils'

/**
 * 
 */
export default class Record
{
	/**
	 * 
	 */
	constructor(data = {})
	{
		// Record data
		this._data = data

		// Record status, matched HTTP status
		// 0 means no status yet
		this._status = 0

		// Data lock
		this._lock = markRaw(new Mutex)

		// List of update callbacks
		this._observers = markRaw({})
	}

	/**
	 *
	 */
	get data()
	{
		return this._data
	}

	/**
	 * 
	 */
	get requiresUpdate()
	{
		return this._status === 0 || this._status == 401 || this._status > 499
	}

	/**
	 *
	 */
	syncUpdate(update)
	{
		try
		{
			// Do update
			update()

			// Notify observers
			this._afterUpdate()
		}
		catch (err)
		{
			// Handle error
			this._handleError(err)
		}

		return this._data
	}

	/**
	 *
	 */
	async asyncUpdate(update)
	{
		// Acquire lock first
		const release = await this._lock.acquire()
		
		try
		{
			// Do update
			await update()
			
			// Notify observers
			this._afterUpdate()
		}
		catch (err)
		{
			// Handle error
			this._handleError(err)
		}

		// Release lock
		release()

		// Return record data
		return this.data
	}

	/**
	 * 
	 */
	async maybeUpdate(update)
	{
		// Acquire lock first
		const release = await this._lock.acquire()
		
		if (this.requiresUpdate)
		{
			// TODO: Handle error
			// Do update
			try
			{
				await update()
				
				// Notify observers
				this._afterUpdate()
			}
			catch (err)
			{
				// Handle error
				this._handleError(err)
			}
		}

		// Release lock
		release()

		// Return record data
		return this.data
	}

	/**
	 *
	 */
	_afterUpdate()
	{
		/**
		 *
		 */
		const notify = ({ handler, options }) => {

			// Get observer options and callbacks
			let [ callback ] = arrify(handler)
			let { once = false } = options

			// Execute callback
			if (!!callback && isFunction(callback)) callback(this.data)

			// If receives single update, return false
			return !once;
		}

		// Notify all observers
		const keys = Object.keys(this._observers); for (let key of keys)
		{
			// Notify and possibly unregister observer
			notify(this._observers[key]) || (delete this._observers[key])
		}
	}

	/**
	 *
	 */
	_handleError(err)
	{
		/**
		 *
		 */
		const notify = ({ handler, options }) => {

			// Get observer options and error callback
			let [ , callback ] = arrify(handler)
			let { once = false } = options

			// Execute error callback
			if (!!callback && isFunction(callback)) callback(err)

			// If receives single update, return false
			return !once;
		}

		// Get status
		let [ , status ] = err
		this._status = status

		// Notify all observers
		const keys = Object.keys(this._observers); for (let key of keys)
		{
			// Notify and possibly unregister observer
			notify(this._observers[key]) || (delete this._observers[key])
		}
	}

	/**
	 *
	 */
	onUpdate(handler, options = {})
	{
		// Generate unique id to identify observer
		const id = uuid()

		// Add to observers list
		this._observers[id] = { handler, options }

		// Return unsubscribe callback
		return async () => delete this._observers[id]
	}

	/**
	 *
	 */
	waitUpdate()
	{
		return new Promise((resolve, reject) => this.onUpdate([resolve, reject], {
			once: true
		}))
	}

	/**
	 * 
	 */
	waitReady()
	{
		return new Promise((resolve, reject) => {

			// If requires update, wait for update
			if (this.requiresUpdate) this.onUpdate([resolve, reject], {
				once: true
			})
			// Else resolve immediately
			else resolve(this.data)
		})
	}
}