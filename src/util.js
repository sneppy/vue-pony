import { isObject } from 'lodash'
import { isModel } from './types'

/**
 * Returns wrapped value if not already array.
 * @param {*} val - value to wrap in array
 * @returns {Array} wrapped value
 */
export const arrify = (val) => Array.isArray(val) ? val : [val]

/**
 * Returns the first element of a single-value array or the value as-is.
 * @param {*} val - value that must be dearrified
 * @returns {*} dearrified array or value as-is
 */
export const dearrify = (val) => val.length === 1 ? val[0] : val

/**
 * Parses a string as an integer.
 * @param {string} str - input string
 * @returns {number} integer value or not a number
 */
export const parseIdx = (str) => {
	
	let idx = 0; for (let i = 0, len = str.length; i < len; ++i)
	{
		// Get value
		let val = str.charCodeAt(i) - 48

		// Return not a number if not integer
		if (val < 0 || val > 9) return NaN

		// Update idx value
		idx = (idx * 10) + val
	}

	return idx
}

/**
 * Replaces any entity found with its primary key.
 * @param {*} val - value to dump
 * @return {*} transformed value
 */
export const dump = (val) => {

	if (isModel(val))
	{
		return dearrify(val._pk)
	}
	else if (Array.isArray(val))
	{
		return val.map(dump)
	}
	else if (isObject(val))
	{
		// Shallow copy object
		let obj = { ...val }

		// Dump properties
		for (let prop in obj) obj[prop] = dump(obj[prop])

		// Return object
		return obj
	}
	else return val
}
