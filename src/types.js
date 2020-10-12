/**
 * Record base interface.
 *
 * @interface
 */
export class RecordType
{
	/**
	 *
	 */
	get _status()
	{
		// TODO: Throw error
		return 200
	}

	/**
	 * True if status is non-zero
	 *
	 * @type boolean
	 */
	get _ready()
	{
		return this._status !== 0
	}
	/**
	 * True if status is `200 OK` or `201 CREATED`
	 *
	 * @type boolean
	 */
	get _ok()
	{
		return this._status === 200 || this._status === 201
	}
	/**
	 * True if status is `200 OK`
	 *
	 * @type boolean
	 */
	get _found()
	{
		return this._status === 200
	}
	/**
	 * True if status is `404 NOT FOUND`
	 *
	 * @type boolean
	 */
	get _notfound()
	{
		return this._status === 404
	}
}

/**
 * Interface for models.
 * 
 * @interface
 */
export class ModelType extends RecordType
{
	/**
	 * Empty constructor.
	 */
	constructor()
	{
		// Stupid JavaScript
		super()

		// Prevent construction
		if (new.target === ModelType) throw TypeError('Cannot construct object of abstract type `ModelType`')
	}

	/**
	 * Returns self.
	 */
	get _self()
	{
		return this
	}
}

/**
 * Returns true if value is a model instance.
 * 
 * @param {*} val value to test
 * @returns {boolean} true if is model
 */
export const isModel = (val) => val instanceof ModelType

/**
 * Interface for set classes.
 * 
 * @interface
 */
export class SetType extends RecordType
{
	/**
	 * Empty constructor.
	 */
	constructor()
	{
		// Stupid JavaScript...
		super()

		// Prevent construction
		if (new.target === SetType) throw TypeError('Cannot construct object of abstract type `SetType`')
	}

	/**
	 * Returns self.
	 */
	get _self()
	{
		return this
	}
}

/**
 * Returns true if value is a set.
 * 
 * @param {*} val value to test
 * @returns {boolean} true if is set
 */
export const isSet = (val) => val instanceof SetType
