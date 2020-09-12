import { isEmpty } from 'lodash'

/**
 * 
 */
export default function request(base, method, uri, params = {}, headers = {}) {

	// Build url
	let url = base + uri + (isEmpty(params) ? '' : '?' + new URLSearchParams(params))

	// Initialize request
	let xhr = new XMLHttpRequest
	xhr.open(method, url)
	xhr.responseType = 'json'

	// Set headers
	Object.entries(headers).forEach((header) => xhr.setRequestHeader(...header))

	// Authorize request
	if (this && this.authorize) this.authorize(xhr)

	// Return request dispatcher
	return (data) => {

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
						if (xhr.status < 300)
						{
							resolve(xhr.response)
						}
						else
						{
							reject(xhr.response)
						}

						break
				}
			}

			// Dispatch request
			xhr.send(encode(xhr))
		})
	}
}