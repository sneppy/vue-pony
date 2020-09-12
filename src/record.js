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

		// Record flags
		this._flags = false // TODO: Actually have flags here, when necessary

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
		return !this._flags
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

				// Set empty flag
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

		// Update record state
		this._flags = true

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

		// Update record state
		this._flags = false

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