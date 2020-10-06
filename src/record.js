import { isArray, isFunction } from "lodash"
import { markRaw } from "vue"
import { v4 as uuid } from 'uuid'
import { Mutex } from "async-mutex"
import { arrify } from "./util"

/**
 * Represents a snapshot of data fetched from the server.
 */
export default class Record
{
	/**
	 * Create a new record with given data.
	 * @param {*} data record data
	 */
	constructor(data)
	{
		/**
		 * Record data.
		 */
		this.data = data

		/**
		 * Record status, either an HTTP status or `0` if unset.
		 */
		this.status = 0

		/**
		 * 
		 */
		this._expires = Date.now()

		/**
		 * Mutex used to prevent writing conflicts
		 * @private
		 */
		this._lock = markRaw(new Mutex)

		/**
		 * List of observers
		 * @private
		 */
		this._observer = markRaw({})
	}

	/**
	 * 
	 */
	isExpired()
	{
		return this.status === 0 || this._expires < Date.now()
	}

	/**
	 * Update record from request.
	 * @param {function} request - request dispatcher
	 * @param  {...any} params - optional set of parameters to pass to dispatcher
	 */
	async fromRequest(request, ...params)
	{
		// Dispatch request and get body and status
		let [ data, status, xhr ] = await request(...params)
		
		// TODO: Get Cache-Control

		// Update status and expire
		this.status = status
		this._expires = Date.now() + 60000

		if (isArray(this.data) && isArray(data))
		{
			// Replace all elements
			this.data.splice(0, Infinity, ...data)
		}
		else
		{
			// Merge objects
			Object.assign(this.data, data)
		}
	}
	
	/**
	 * Perform an update asynchronously
	 * @param {function} doUpdate - update callback
	 * @returns {Record} self
	 */
	async asyncUpdate(doUpdate)
	{
		// Acquire data lock
		const release = await this._lock.acquire()

		try
		{
			// Perform update
			await doUpdate()

			// Notify observers
			this._afterUpdate()
		}
		catch (err)
		{
			// TODO: Handle error
		}
		finally
		{
			// Release lock
			release()
		}

		return this
	}
	
	/**
	 * Like {@link asyncUpdate}, but only if record is unset or outdated.
	 * @param {function} doUpdate - update callback
	 * @returns {Record} self
	 */
	async maybeUpdate(doUpdate)
	{
		// Acquire data lock
		const release = await this._lock.acquire()

		try
		{
			if (this.isExpired())
			{
				// Perform update
				await doUpdate()

				// Notify observers
				this._afterUpdate()
			}
		}
		catch (err)
		{
			// TODO: Handle error
		}
		finally
		{
			// Release lock
			release()
		}

		return this
	}
	
	/**
	 * After record udpate notify observers
	 * @private
	 */
	_afterUpdate()
	{
		const keys = Object.keys(this._observer.update || {}); for (let key of keys)
		{
			// Get handler
			const [ handler ] = arrify(this._observer.update[key])

			if (handler && isFunction(handler))
			{
				// Execute callback and possibly remove it
				if (handler(this) === false) delete this._observer.update[key]
			}
		}
	}
	
	/**
	 * Subscribe observer to event.
	 * @param {string} event - event type
	 * @param {function|Array<function>} handler - event handler, or array with callback and error handler
	 * @return {function} unsubscribe function
	 */
	on(event, handler)
	{
		// Generate unique id for observer
		const id = uuid()

		// Register observer
		this._observer[event] = this._observer[event] || {}
		this._observer[event][id] = handler

		/**
		 * Unsubscribe function.
		 */
		const unsub = () => delete this._observer[event][id]

		return unsub
	}

	/**
	 * @see on
	 */
	wait(event)
	{
		// Return promise that resolves on event
		return new Promise((resolve, reject) => this.on(event, [ resolve, reject ]))
	}
}
