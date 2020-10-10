import { isArray, isFunction, cloneDeepWith } from 'lodash'
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
 * Creates an unreactive copy of the given object
 * @param {Object} obj - reactive object
 */
const unreactive = (obj) => {

	return cloneDeepWith(obj)
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
		 * Returns true if recors is in patch mode
		 * @return {boolean} patch mode flag
		 */
		const isPatchMode = () => !!this._patchMode

		// Ref to self
		const record = this
		
		/**
		 * Record data.
		 */
		this.data = new Proxy(data, {
			/**
			 * Return data from patch if any.
			 * if in patch mode returns tracker.
			 */
			get(target, prop, self) {

				if (prop in record.patches)
				{
					// Return patched value
					return record.patches[prop]
				}

				// Get actual value
				let value = Reflect.get(...arguments)
				
				if (isPatchMode() && (typeof value === 'object'))
				{
					/**
					 * Creates tracker from obj.
					 */
					const Tracker = (obj, getParent) => {

						return new Proxy(obj, {
							/**
							 * Wrap another tracker if object.
							 */
							get(target, prop, self) {

								// Get prop value
								const value = Reflect.get(...arguments)

								if (typeof value === 'object' && !prop.startsWith('__v_'))
								{
									// If is object, return another tracker
									return Tracker(value, () => getParent()[prop])
								}
								// Return value as-is
								return value
							},

							/**
							 *
							 */
							set(target, prop, value, self) {

								if (prop in target)
								{
									// Write value onto parent (should create a patch)
									return (getParent()[prop] = value, true)
								}
								// If not a property, don't patch it
								// TODO: Not sure, this doesn't allow us to add properties, I think I should allow it
								else return Reflect.set(...arguments)
							}
						})
					}

					// Return tracker, if value will be written create unreactive copy of value
					return Tracker(value, () => (record.patches[prop] = unreactive(value)))
				}
				// If not in patch mode or not object, return value as-is
				else return value
			},

			/**
			 * If in patch mode, keeps track of changes.
			 */
			set(target, prop, value, self) {

				if (isPatchMode() && (prop in target))
				{
					// Patch value
					return (record.patches[prop] = value, true)
				}
				else return Reflect.set(...arguments)
			}
		})

		/**
		 * Record status, either an HTTP status or `0` if unset.
		 */
		this.status = 0

		/**
		 * Data patches.
		 */
		this.patches = {}

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
	 * Execute function with data lock
	 */
	async withDataLock(func)
	{
		// Lock data
		const release = await this._lock.acquire()

		// Execute function
		await func(this)

		// Unlock data
		release()
	}

	/**
	 * Execute patch function in patch mode.
	 * @param {function} doPatch - patch function
	 */
	async withPatchMode(doPatch)
	{
		// Lock data
		const release = await this._lock.acquire()

		// Do patch
		this._patchMode = true
		doPatch()
		this._patchMode = false
		
		// Unlokc data
		release()
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

		return this
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
			// TODO: This must always be called, make sure it stays that way
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
