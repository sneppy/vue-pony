# vue-pony

**vue-pony** is a intuitive and easy to use interface to interact with your REST API.

When designing this library I was inspired by [PonyORM](https://ponyorm.org/), an awesome ORM library for Python that I use for my backend.

> DISCLAIMER: I develop this project for my personal use. I won't generally be accepting any pull request and I'm not going to actively look into open issues. You are free to use this package as-is if you like it.

Usage example
-------------

_vue-pony_ assumes that the REST API conforms to a certain structure, as explained below:

```javascript
import Pony from 'vue-pony'

// Create a new Pony instance
let api = new Pony({
	base: 'https://api.your.io' // Base URL for api endpoints, e.g. `https://api.your.io/user/1`
})

// The `api.Model` class must be
// extended to create entities
// such as users, posts, comments,
// etc.
class User extends api.Model
{
	// By default, Pony assigns an
	// index to models equal to the
	// lowercase class name, `user`
	// in this case.
	// This index is used to build
	// the resource URI.

	// Static methods and properties
	// are used to define relationships
	// within entities.
	static get posts()
	{
		// A set is a collection of entities.
		// Pony assumes that the URI `user/1/post`
		// returns a list of post indices, e.g.
		// `[1, 5, 10, 21, 22]`.
		return api.Set(Post)
	}

	// We use getters when the model
	// has not yet been defined.
	static get comments()
	{
		return api.Set(Comment)
	}
}

class Post extends api.Model
{
	// Here, Pony assumes that in the
	// post data there's a property
	// named `author` with the id of
	// the user.
	static author = User

	static get comments()
	{
		return api.Set(Comment)
	}
}

class Comment extends api.Model
{
	// If the class name differs from the name
	// of the actual property, we may use the
	// `Required` helper to specify mapping
	// options.
	// The relationship is still accessed as
	// `comment.author`.
	static author = api.Required(User, {
		mapping: 'user' // Instead of `author`
	})

	// Alternatively a mapping may be specified
	// as a function that receives this instance
	static post = api.Required(Post, {
		mapping: (comment) => comment.postId // Instead of `post`
	})
}

// Export models
export { User, Post, Comment }
```

General usage:

```javascript
import { watchEffect } from 'vue' // Vue 3.x
import { User } from '@/api' // Import models from api definition

// Get user with id 1
let user = User.get(1)

// Call is synchronous, thus if you
// log user data it will print `undefined`
console.log(user.username)

// However we can leverage the reactivity
// with Vue's `watchEffect`
watchEffect(() => console.log(user.username)) // Eventually it will log the username

// The same applies to relationships
let post = Post.get(1)
watchEffect(() => console.log(post.author && post.author.username))
```

Inside a Vue component:

```html
<template>
	<div class="post">
		<div class="author">
			<span>Created by {{ author.username }}</span>
		</div>

		<div class="content">
			{{ post.content }}
		</div>
	</div>
</template>

<script>
import { Post } from '@/api'

export default {
	name: 'Post',

	props: {
		/// Post entity provided as prop
		post: {
			type: Post,
			required: true
		}
	},

	setup(props) {
		
		let author = computed(() => post.author)

		return { author }
	}
}
</script>
```