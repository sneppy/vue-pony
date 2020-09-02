/**
 * 
 */
export default function Required(matrix, options = {}) {

	// Unpack options
	const { mapping } = options

	/**
	 * 
	 */
	return class Required extends matrix
	{
		static index()
		{
			// Avoid using `required`
			return matrix.index()
		}

		/// Set mapping property
		static mapping = mapping
	}
}