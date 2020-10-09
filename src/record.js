import { isArray, isFunction } from 'lodash'
import { v4 as uuid } from 'uuid'
import { Mutex } from 'async-mutex'
import { arrify } from './util'

/**
 * Overrides default Vue function.
 * @param {Object} obj - object marked as raw
 * @returns {Object} same object, marked raw
 */
const markRaw = (obj) => {

	try
	{
		// Require and use 
		return require('vue').markRaw(obj)
	}
	catch (err)
	{
		// Silent, don't mark raw
		return obj
	}
}

/**
 * This class represents a snapshot of data fetched from the server.
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
		 * Creates a new tracker object from the given one.
		 * @param {Object} obj - data object to wrap
		 * @returns {Proxy} tracker
		 */
		const Tracker = (obj, onTrackProp) => {
		
			/**
			 * Returns patch mode flag
			 * @returns {boolean} true if patching
			 */
			const isPatchMode = () => this._patchMode

			return new Proxy(obj, {
				/**
				 * 
				 * @param {Object} target - data object
				 * @param {string|Symbol|number} prop - prop name
				 * @param {*} value - prop value
				 * @param {Proxy} self - proxy object
				 * @returns {*} requested prop value
				 */
				get(target, prop, self) {

					// Get value
					let value = Reflect.get(...arguments)
					
					if (isPatchMode() && typeof value === 'object')
					{
						// Return tracker
						return Tracker(value, onTrackProp || (() => {

							// TODO: track only top level dep
							console.log('TRACK', prop)
						}))
					}
					else return value
				},

				/**
				 * If in patch mode, keeps track of changes made.
				 * @param {Object} target - data object
				 * @param {string|Symbol|number} prop - prop name
				 * @param {*} value - prop value
				 * @param {Proxy} self - proxy object
				 * @returns {boolean}
				 */
				set(target, prop, value, self) {

					// Get old value
					const oldValue = Reflect.get(target, prop, self)

					if (Reflect.has(target, prop) && Reflect.set(...arguments))
					{
						// If set was ok, try to track patches
						if (isPatchMode() && (value !== oldValue))
						{
							if (onTrackProp) onTrackProp()
							else
							{
								console.log('TRACK', prop)
							}
						}

						return true
					}
					else return Reflect.set(...arguments)
				}
			})
		}

		/**
		 * Record data.
		 */
		this.data = Tracker(data)

		/**
		 * Record status, either an HTTP status or `0` if unset.
		 */
		this.status = 0

		/**
		 * 
		 */
		this._expires = Date.now()

		/**
		 * Mutex used to prevent writing conflicts.
		 * @private
		 */
		this._lock = markRaw(new Mutex)

		/**
		 * List of observers.
		 * @private
		 */
		this._observer = markRaw({})

		/**
		 * Patch mode flag.
		 * @private
		 */
		this._patchMode = false
	}

	/**
	 * Returns true if record is expired or invalid from the beginning.
	 * @returns {boolean} expire flag
	 */
	isExpired()
	{
		return this.status === 0 || this._expires < Date.now()
	}

	/**
	 * Returns true if request is fullfilled or rejected.
	 * @returns {boolean} true if status is 200 or 201
	 */
	isReady()
	{
		return this.status !== 0
	}

	/**
	 * 
	 * @param {*} doPatch 
	 */
	_withPatchMode(doPatch)
	{
		// TODO: Do we need locks?
		// Set patch flag
		this._patchMode = true

		// Do patch
		doPatch()

		// Uset patch flag
		this._patchMode = false
	}

	/**
	 * Merge external data with record data
	 * @param {Object} data - source data
	 * @return {Object} record data
	 */
	merge(data)
	{
		// Merge data objects
		Object.assign(this.data, data)

		return this.data
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
	 * @param {UpdateCallback} doUpdate - update callback
	 * @returns {Record} self
	 */
	async asyncUpdate(doUpdate)
	{
		// Acquire data lock
		const release = await this._lock.acquire()

		try
		{
			// Perform update
			await doUpdate(this.fromRequest.bind(this))

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
	 * @returns {Promise<this>} self
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
				await doUpdate(this.fromRequest.bind(this))

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
	 * Execute the delete function, delete record and notify observers.
	 * @param {function} doDelete - delete function
	 * @returns {Promise<this>} promise that resolves with record itself
	 */
	async asyncDelete(doDelete)
	{
		// Acquire lock on data
		const release = await this._lock.acquire()

		try
		{
			// Execute delete function
			await doDelete(this.fromRequest.bind(this))

			// Notify observers
			this._afterDelete()
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
	 * After record delete, notify observers
	 * @private
	 */
	_afterDelete()
	{
		const keys = Object.keys(this._observer.delete || {}); for (let key of keys)
		{
			// Get handler
			const [ handler ] = arrify(this._observer.delete[key])

			if (handler && isFunction(handler))
			{
				// Execute callback
				handler(this)

				// Delete observer, record doesn't exists anymore
				delete this._observer.delete[key]
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

		switch (event)
		{
			case 'ready':
				// Check if already fulfilled
				if (this.isReady())
				{
					// Immediately execute callback
					let [ callback ] = arrify(handler)
					return (callback(this), () => {}) // Empty unsub
				}
				else
				{
					// Register as update event listener
					event = 'update'
					
					// Callback must check `isReady`
					let [ onReady, onError ] = arrify(handler)
					handler = [
						() => {
							
							if (this.isReady())
							{
								// Execute callback and unregister obs
								return (onReady(this), false)
							}
							else ; // Do nothing
						},
						onError
					]
				}
		}

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
		// Return promise that resolves on event (and unsubscribe)
		return new Promise((resolve, reject) => this.on(event, [ (self) => (resolve(self), false), reject ]))
	}
}

/**
 * Callback required when updating a record
 * @callback UpdateCallback
 * @param {*} req - request object
 * @param {...*} data - request data
 */
