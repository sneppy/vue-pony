/**
 * 
 */
export default function Required(matrix, options = {}) {

	// Unpack options
	const { mapping, readonly = false } = options

	/**
	 * 
	 */
	return class Required extends matrix
	{
		static index()
		{
			// Prevents using `required`
			return matrix.index()
		}

		/// Set mapping property
		static mapping = mapping

		/// Readonly flag
		static readonly = readonly
	}
}