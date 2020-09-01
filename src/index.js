import { identity } from 'lodash'
import { watchEffect } from 'vue'
import Model from './model'
import Set from './set'
import request from './request'
import Store from './store'

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
}

let api = new Pony({
	authorizer: {
		authorize(xhr) {

			xhr.setRequestHeader('Authorization', 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE1OTg3OTM0NTYsIm5iZiI6MTU5ODc5MzQ1NiwianRpIjoiNGIxYzRiYjAtZDJmYi00MGI1LTgyNjAtYTQxZGNhYzczZmI1IiwiZXhwIjoxNjA3NDMzNDU2LCJpZGVudGl0eSI6MiwiZnJlc2giOmZhbHNlLCJ0eXBlIjoiYWNjZXNzIn0.XMo0M0MdemwV01Q0VnC7bfYXhEtEW1uHMKIRBiDKg60')
		}
	},
	base: 'http://sneppy.ddns.net:5000/api/v1'
})

class User extends api.Model
{
	static get posts()
	{
		return api.Set(Post)
	}
}

class Adventure extends api.Model
{
	static get posts()
	{
		return api.Set(Post)
	}
}

class Post extends api.Model
{
	static author = User
}

let posts = Post.get()
watchEffect(() => console.log(posts[1].title))