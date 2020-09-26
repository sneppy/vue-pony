import Pony from '.'
import { watchEffect, computed } from 'vue'
import request from './request'
import { pick, identity } from 'lodash'
import { arrify } from './utils'
import Required from './required'
import { isModel } from './model'

/**
 * 
 */
const authorize = (xhr) => {

	const token = localStorage.getItem('token')
	if (!!token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)
}

/**
 * 
 */
const auth = async (credentials, service = 'login') => {

	try
	{
		const [ { access_token: token } ] = await api.request('POST', `/auth/${service}`)(credentials)
		if (!!token) localStorage.setItem('token', token)
	}
	catch (err)
	{
		const [ , status ] = err
		if (status === 401 || status === 403) alert('Wrong login credentials')
	}
}

/**
 * 
 */
const check = async () => {

	try
	{
		return (await api.request('GET', `/auth/check`)(), true)
	}
	catch (err)
	{
		return false
	}
}

// Setup Pony
let api = new Pony({
	base: 'http://localhost:5000/api/v1',
	authorize
})

/**
 *
 */
class Image extends api.Model
{
	static uri(alias, path = '')
	{
		return '/' + ['util', this.index(), ...alias].join('/') + path
	}
}

/**
 *
 */
class User extends api.Model
{
	/// User image
	static image = Image
}

/**
 *
 */
export class Fellow extends api.Model
{
	/// Custom primary key
	get _pk()
	{
		return [this._data.sender, this._data.recipient]
	}
	
	/**
	 *
	 */
	static uri([ senderid, recipientid ], path = '')
	{
		return `/user/${senderid}/fellow/${recipientid}` + path
	}

	/// Sender user
	static sender = User

	/// Recipient user
	static recipient = User
}

/**
 *
 */
class Adventure extends api.Model
{
	/// Owner of the adventure
	static owner = User

	///
	static get members()
	{
		return api.Set(AdventureMember)
	}
}

/**
 *
 */
class AdventureMember extends api.Model
{
	static index()
	{
		return 'member'
	}

	static uri([ userid, adventureid ]) {

		return `/adventure/${adventureid}/member/${userid}`
	}

	/// User
	static user = User

	/// Adventure
	static adventure = Adventure
}

/**
 *
 */
class Post extends api.Model
{
	/// Post author
	static author = User

	/// Adventure associated to this post
	static adventure = Adventure
}

auth({
	login: 'sneppy',
	password: 'qwerty'
}).then(() => {
	
	let user = User.get('me')
	api.wait(() => user.id).then((id) => {
		
		let me = User.get('me')
		me._invalidate()
		console.log(me.username)

		me._wait((u) => u.username).then(console.log)
	})
})