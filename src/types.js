/**
 * Interface for models.
 */
export class ModelType
{
	/**
	 * Empty constructor.
	 */
	constructor()
	{
		// Prevent construction
		if (new.target === ModelType) throw TypeError('Cannot construct object of abstract type `ModelType`')
	}
}

/**
 * Returns true if value is a model instance.
 * @param {*} val value to test
 * @returns {boolean} true if is model
 */
export const isModel = (val) => val instanceof ModelType

/**
 * Interface for set classes.
 */
export class SetType
{
	/**
	 * Empty constructor.
	 */
	constructor()
	{
		// Prevent construction
		if (new.target === SetType) throw TypeError('Cannot construct object of abstract type `SetType`')
	}
}

/**
 * Returns true if value is a set.
 * @param {*} val value to test
 * @returns {boolean} true if is set
 */
export const isSet = (val) => val instanceof SetType
