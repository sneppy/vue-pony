import { identity } from 'lodash'
import { watchEffect, computed } from 'vue'
import Model from './model'
import Set from './set'
import request from './request'
import Store from './store'
import Required from './required'

/**
 * 
 */
export default class Pony
{
	/**
	 * 
	 */
	constructor(options = {})
	{
		let { authorizer = null, base = '' } = options

		// Setup request method
		this.request = request.bind(this, base)

		// Create store
		// TODO: custom store
		this.store = Store()

		// Create authorizer
		this.authorizer = authorizer
		this.authorize = authorizer && authorizer.authorize.bind(authorizer) || identity
	}

	/**
	 * 
	 */
	get Model()
	{
		return Model.bind(this)()
	}

	/**
	 * 
	 */
	get Set()
	{
		return Set.bind(this)
	}

	/**
	 * 
	 */
	get Required()
	{
		return Required.bind(this)
	}
}

let api = new Pony({
	authorizer: {
		authorize(xhr) {

			xhr.setRequestHeader('Authorization', 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE1OTg3OTM0NTYsIm5iZiI6MTU5ODc5MzQ1NiwianRpIjoiNGIxYzRiYjAtZDJmYi00MGI1LTgyNjAtYTQxZGNhYzczZmI1IiwiZXhwIjoxNjA3NDMzNDU2LCJpZGVudGl0eSI6MiwiZnJlc2giOmZhbHNlLCJ0eXBlIjoiYWNjZXNzIn0.XMo0M0MdemwV01Q0VnC7bfYXhEtEW1uHMKIRBiDKg60')
		}
	},
	base: 'http://sneppy.ddns.net:5000/api/v1'
})

class Image extends api.Model
{
	static uri()
	{
		return '/util' + super.uri(...arguments)
	}
}

class User extends api.Model
{
	///
	static image = Image
}

class Adventure extends api.Model
{
	///
	static owner = User
	
	/**
	 * 
	 */
	static get members()
	{
		return api.Set(AdventureMember)
	}
}

class AdventureMember extends api.Model
{
	///
	static adventure = Adventure

	///
	static user = User
}

class Post extends api.Model
{
	///
	static author = User

	///
	static get commits()
	{
		return api.Set(PostCommit)
	}

	///
	static get head()
	{
		return api.Required(PostCommit, {
			mapping: (post) => [post.id, post._data.head]
		})
	}
}

class PostCommit extends api.Model
{
	///
	static post = Post
}

let user = User.get(1)