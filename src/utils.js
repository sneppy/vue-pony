/**
 * 
 */
export const arrify = (arr) => Array.isArray(arr) ? arr : [arr]

/**
 *
 */
export const dearrify = (arr) => (Array.isArray(arr) && arr.length === 1) ? arr[0] : arr