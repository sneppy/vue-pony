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
		return this._status === 0 || this._status > 499
	}

	/**
	 * 
	 */
	fromRequest([ data, status ])
	{
		// Update data and status
		Object.assign(this._data, data)
		this._status = status
		
		// Return self
		return this
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
			this._handleError(err, 'update')
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
			this._handleError(err, 'update')
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
				this._handleError(err, 'update')
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
	async asyncDelete(del)
	{
		// Acquire lock
		const release = await this._lock.acquire()

		try
		{
			// Perform deletion
			await del()

			// Notify observers
			this._afterDelete()
		}
		catch (err)
		{
			// Delete error
			this._handleError(err, 'delete')
		}

		// Release lock
		release()
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
			if (!!callback && isFunction(callback))
			{
				return callback(this.data) === true || !once
			}
			else return !once;
		}

		// Notify all observers
		const keys = Object.keys(this._observers.update || {}); for (let key of keys)
		{
			// Notify and possibly unregister observer
			notify(this._observers.update[key]) || (delete this._observers.update[key])
		}
	}

	/**
	 *
	 */
	_afterDelete()
	{
		/**
		 *
		 */
		const notify = ({ handler, options }) => {

			// Get observer options and callbacks
			let [ callback ] = arrify(handler)
			let { once = false } = options

			// Execute callback
			if (!!callback && isFunction(callback))
			{
				return callback(this.data) === true || !once
			}
			else return !once;
		}

		// Notify all observers
		const keys = Object.keys(this._observers.delete || {}); for (let key of keys)
		{
			// Notify and possibly unregister observer
			notify(this._observers.delete[key]) || (delete this._observers.delete[key])
		}
	}

	/**
	 *
	 */
	_handleError(err, event = 'update')
	{
		/**
		 *
		 */
		const notify = ({ handler, options }) => {

			// Get observer options and error callback
			let [ , callback ] = arrify(handler)
			let { once = false } = options

			// Execute error callback
			if (callback && isFunction(callback))
			{
				return callback(err) === true || !once
			}
			else return !once;
		}

		// Get status
		let [ , status ] = err
		this._status = status

		// Notify all observers
		const keys = Object.keys(this._observers[event] || {}); for (let key of keys)
		{
			// Notify and possibly unregister observer
			notify(this._observers[event][key]) || (delete this._observers[event][key])
		}
	}

	/**
	 *
	 */
	reset(data)
	{
		// Reset status
		this._status = 0

		// Reset data with provided data or appropriate empty object
		this._data = data !== undefined ? data : (Array.isArray(this._data) ? [] : {})
	}

	/**
	 *
	 */
	invalidate()
	{
		// Simply reset status
		this._status = 0
	}

	/**
	 *
	 */
	_on(event, handler, options)
	{
		// Generate unique id to identify observer
		const id = uuid()

		// Add to observers list
		this._observers[event] = this._observers[event] || {}
		this._observers[event][id] = { handler, options }

		// Return unsubscribe callback
		return async () => delete this._observers[event][id]
	}

	/**
	 *
	 */
	onUpdate(handler, options = {})
	{
		return this._on('update', handler, options)
	}

	/**
	 *
	 */
	onDelete(handler, options = {})
	{
		return this._on('delete', handler, options)
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