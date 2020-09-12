> !!! I develop this project for personal use. I won't generally be accepting any pull request and I'm not going to actively look into open issues. You are free to use this package as-is if you like it.

# vue-pony

**vue-pony** is an intuitive and easy to use interface to interact with your REST API.

> When designing this library I was inspired by [PonyORM](https://ponyorm.org/), an awesome ORM library for Python that I use for the backend. Be sure to check it out!

Basic usage
-----------

Install _vue-pony_ using npm:

```console
$ npm i --save vue-pony
```

Create a new instance of `Pony` in a separate file in the `src` directory (e.g. `src/api.js`):

#### **src/api.js**
```javascript
import Pony from 'vue-pony'

// Create instance
export const api = new Pony({
	base: 'https://api.snoopy.com/path/to/api'
})
```

`base` is the base path for all API endpoints (e.g. `https://api.snoopy.com/path/to/api/user/sneppy`).

In order to work with _vue-pony_, the endpoints must be configured as follow (with a few exceptions):

- `'/' <resource> ('/' <key>)+` should return data for an entity of type `resource` identified by the key `key` (e.g. `/user/1`). If a resource has a composite key, each key component is a separate directory (e.g. `/member/3/2`);
- `'/' <resource>` returns a list of keys that identify multiple entities of type `resource` (e.g. `/post` returns a list of indices of posts authored by the authenticated users, for example `[1, 5, 8, 11, 12]`);
- `'/' <resource> ('/' <key>)+ '/' <other>` returns a list of entities of type `other`, which ideally have some relationship with the entity of type `resource` (e.g. `/user/1/post` returns a list of indices of posts authored by the user identified by key `1`);
- the api shall not return embedded entities, but rather a key to fetch those entities (e.g. `post.author` should have the key of the user, not the user data itself);
- each entity should have a primary key, which by default is the property `id`.

Each type of entity, that we will call _model_, must be defined as a class that extends `api.Model`:

```javascript
export class User extends api.Model
{
	//
}
```

Once defined, we can fetch by id like this:

```javascript
let user = User.get(1)
```

which translates to `base + '/user/1'`. By default, _vue-pony_ uses the lowercase class name to identify the resource type. If the name of the resource differs from the lowercase class name, you can override the `index()` static method:

```javascript
export class User extends api.Model
{
	static index()
	{
		return 'u' // e.g. /u/1
	}
}
```

We can also fetch all entities of type `User` like this:

```javascript
let users = User.get()
```

which returns an object of type `Set`. An object of type `Set` can be iterated like this:

```javascript
for (let user of User.get())
{
	// Do something with `user`
}
```

Entity-to-entity relationships can be defined using static methods or properties, like this:

```javascript
export class Post extends api.Model
{
	static author = User
}
```

_vue-pony_ assumes that `post`'s data object has a property named `author` that holds the key that identifies a `User` entity. If that's not the case, you can use `api.Required()` to define a custom mapping:

```javascript
export class Post extends api.Model
{
	static author = api.Required(User, {
		mapping: 'userId'
	})
}
```

`mapping` can be either a `String` or a function that receives the `Post` instance as a parameter.

Likewise, we can define one-to-many relationships with `api.Set()`:

```javascript
export class User extends api.Model
{
	static posts = api.Set(Post)
}
```

As is usually the case, `Post` will likely be defined after `User`, in which case `api.set(Post)` will throw an error (with `Post` being `undefined`). You can use a static getter to get around this issue:

```javascript
export class User extends api.Model
{
	static get posts()
	{
		return api.Set(Post)
	}
}

export class Post extends api.Model
{
	static author = User
}
```

A relationship can be accessed just like a normal property (e.g. `for (let post of user.posts)`, `post.author.username`, etc.).

Data reactivity
------------------------------

All requests are asynchronous, which means that `User.get(1).title` will return `undefined`.

However, data is completely reactive, which means that we can use all Vue methods to handle it:

```javascript
import { watchEffect } from 'vue'
import { Post, User } from './api'

let post = Post.get(1)
watchEffect(() => console.log(post.author.email))
```

And of course, we can use _vue-pony_ within Vue components:

```html
<template>
	<div>
		<h1>{{ post.title }}</h1>
		<small>by {{ author.username }}</small>
	</div>
</template>

<script>
import { computed } from 'vue'
import { Post } from '@/api'

export default {
	name: 'Post',
	setup: () => {

		let post = Post.get(1)
		let author = computed(() => post.author)

		return { post, author }
	}
}
</script>
```

Furthermore, _vue-pony_ stores fetched data inside a reactive store. This has two consequences:

- future `.get()` requests will immediately fill model with previously fetched data, while asynchronously update it with newer content;
- data is centralized: multiple requests to the same resource actually refer the same data object, which means that future updates will be reflected everywhere.

> The latter is true also when two or more requests refer to the same entity, even if with different URIs. For instance, user `{id: 1, username: 'snoopy', email: 'snoopy@sneppy.io'}` may be addressed as `/user/1`, `/user/snoopy` and `/user/snoopy@sneppy.io`. _vue-pony_ uses the primary key to discriminate different entities.

For instance, say we display the picture of the autheticated user (e.g. `/user/me`) in the header bar and in the profile page. If we go and change the value of the profile picture from the user profile:

```javascript
setup() {

	let me = User.get('me')
	const updatePicture = (url) => me.picture = url

	return { me, updatePicture }
}
```

The picture in the header will change accordingly!

Waiting for data
----------------

Instead of leveraging reactivity, we can wait for data to be available.

`Model._wait()` returns a `Promise` that resolves with the entity itself or the provided expression when data is ready:

```javascript
User.get(1)._wait().then((user) => console.log(user.username))
User.get(1)._wait((user) => user.username).then(console.log)
```

If we need to fetch a chain of entities (e.g. `post.author.username`) we can use `api.wait()` instead:

```javascript
api.wait(() => Post.get(1).author.username).then(console.log)
```

Note that waiting for `() => post.author` will only wait for `post`. Likewise, waiting for `post` will not wait at all. In this case you must use `Model._self` to force data access:

```javascript
api.wait(() => Post.get(1).author._self).then((author) => console.log(author.username, author.email))
```

Remember to keep the expression as simply as possible. `api.wait()` works by forcing `api.Model` to return a promise when a property is accessed, which means that the return value of `post.author.username` is actually a `Promise` rather than a String.

Of course, you can use `async/await` to overcome this limitation:

```javascript
api.wait(async () => {

	let author = await Post.get(1).author._self
	return [author.firstName, author.lastName].join(' ')
}).then(console.log)
```

Writing data
------------

@todo