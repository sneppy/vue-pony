/**
 * 
 */
export const arrify = (arr) => Array.isArray(arr) ? arr : [arr]

/**
 * 
 */
export const dearrify = (arr) => (Array.isArray(arr) && arr.length === 1) ? arr[0] : arr

/**
 * 
 */
export const parseIdx = (idx) => {

	let j = 0, val = 0;
	for (let cc = idx.charCodeAt(j); j >= 48/* '0' */ && j < 58/* '9' + 1 */; cc = idx.charCodeAt(++j))
	{
		// Update value
		val = (val * 10) + (cc - 48/* '0' */)
	}

	// Throw error if string is not fully parsed
	if (j !== idx.length) throw TypeError('Not an Integer')

	return val
}