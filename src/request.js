import { isEmpty } from 'lodash'

/**
 * Creates a new request and returns dispatch method.
 * @param {URL|string} base - base URL
 * @param {string} method - HTTP method
 * @param {string} uri - enpoint relative to base URL
 * @param {Object} [params={}] - query parameters
 * @param {Object} [headers={}] - map of request headers
 * @returns {dispatch} dispatcher
 */
export default function request(base, method, uri, params = {}, headers = {}) {

	// Build complete url
	let url = base + uri + (isEmpty(params) ? '' : '?' + new URLSearchParams(params))

	// Initialize request
	let xhr = new XMLHttpRequest
	xhr.open(method, url)
	xhr.responseType = 'json'

	// Set headers
	Object.entries(headers).forEach((header) => xhr.setRequestHeader(...header))

	// Authorize request
	if (this && this.authorize) this.authorize(xhr)

	/**
	 * Dispatches request.
	 * @param {*} data - request body
	 * @returns {Promise<Response>} promise that resolves with response body, status and xhr object
	 */
	const dispatch = (data) => {

		// Encode data
		const encode = (xhr) => {

			switch (typeof data)
			{
				case 'string':
				case 'number':
				case 'boolean':
					// Send simple types as text
					xhr.setRequestHeader('Content-Type', 'text/plain')
					return data
				
				default:
					// Resolve complex type
					if (data instanceof FormData)
					{
						xhr.setRequestHeader('Content-Type', 'multipart/form-data')
						return data
					}
					else
					{
						// By default send as json
						xhr.setRequestHeader('Content-Type', 'application/json')
						return JSON.stringify(data)
					}
			}
		}

		return new Promise((resolve, reject) => {

			// Set callback
			xhr.onreadystatechange = () => {

				switch (xhr.readyState)
				{
					case XMLHttpRequest.DONE:
					{
						if (xhr.status < 400)
						{
							// If status is not error, resolve promise
							resolve([xhr.response, xhr.status, xhr])
						}
						else
						{
							// If status is 4XX or 5XX reject promise
							reject([xhr.response, xhr.status, xhr])
						}

						break
					}
				}
			}

			// Dispatch request
			xhr.send(encode(xhr))
		})
	}

	// Return dispatcher
	return dispatch
}

/**
 * @typedef {Array} Response
 * @property {*} 0 - response body (parsed)
 * @property {number} 1 - HTTP reponse status
 * @property {XMLHttpRequest} 2 - the xhr object
 */
