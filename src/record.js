import { isEmpty } from 'lodash'

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
		// Set data
		this._data = data

		// Data lock
		this._lock = false
	}

	/**
	 * 
	 */
	get requiresUpdate()
	{
		return isEmpty(this._data)
	}

	/**
	 * 
	 */
	async maybeUpdate(update)
	{
		// TODO: Not very good, if requires update, check lock and wait until lock is free and check again
		if (this.requiresUpdate && !this._lock)
		{
			// Set lock
			this._lock = true

			// Do update
			await update()

			// Unset lock
			this._lock = false
		}

		// Return record data
		return this._data
	}
}