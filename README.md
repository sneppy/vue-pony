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

Sets
----

`api.Set` represent a collection of entities. A set has one or more indices that identify one or more entities of the same type:

```javascript
api.Set(Post).all() // Fetch all posts
```

Sets can be iterated:

```javascript
for (let post of api.Set(Post).all())
{
	api.wait(() => post.author.username).then(console.log) // Print username of all authors
}
```

`api.Set` supports random access as well:

```javascript
api.wait(() => posts[0]._self).then(console.log)
```

Any array method or property (such as `filter`, `map`, `forEach`, or `length`) can be invoked on the set:

```javascript
posts.forEach((post) => api.wait(() => post.author.username).then(console.log))
console.log(posts.length)
```

Bear in mind that the return value of `map`, `filter`, and similar methods is of type `Array` rather than `api.Set`.

As with `Model`, we can wait for a set with `Set._wait()`. Sets can also have partial support for `api.wait()`, but only when accessed as a property of an entity:

```javascript
api.wait(() => User.get(1).posts.length).then(console.log)
// Not like this
api.wait(() => api.Set(Post).all().length).then(console.log)
```

Sets can be populated using three static methods, or relative aliases, as shown below:

| Method | Description | Alias | Request |
| ------ | ----------- | ----- | ------- |
| `api.Set(Type).all()` | Fetch all entities of type `Type` | `Type.get()` with no parameters | `Type.uri()` with no parameters (e.g. `/type`) |
| `api.Set(Type).in(other)` | One-to-many relationship | `other.types` with `class Other extends api.Model { static types = api.Set(Type) }` | `Other.uri([], '/' + Type.index())` (e.g. `/other/1/type`) |
| `api.Set(Type).search(query)` | Asynchronous search | `Type.search(query)` | `Type.uri([], '/search')` (e.g. `/type/search`) |

The `api.Set.search()` method is asynchronous and doesn't use the reactive store, which means you cannot use Vue reactivity on the set. However, you can use reactivity on the single entities:

```javascript
import { watchEffect } from 'vue'

api.Set(Post).search({
	title: 'Snoopy'
}).then((posts) => watchEffect(() => console.log(posts.map((post) => post.author.username))))
```

API authorization
-----------------

It is usually the case that requests need to be authorized using some kind of mechanism. When creating a new instance of `Pony` provide an authorization method in the constructor:

```javascript
const authorize = (xhr) => {

	// Example using local storage
	const token = localStorage.getItem('token')
	xhr.setRequestHeader('Authorization', 'Bearer ' + token)
}

let api = new Pony({
	base: 'https://api.charlie.com',
	authorize
})
```

The method receives the `XMLHttpRequest` instance as its parameter. In the example above, we use the bearer token stored in `localStorage` to authorize subsequent requests, but you may implement a different type of autorization method.

Depending on what kind of authorization mechanism is employed, at some point you may require the user to authenticate itself. This must be done outside the normal flow of _vue-pony_.

However, you can use `Pony.request()` anywhere to create and dispatch requests using the base path and the authorizer specified in the constructor. For example:

```javascript
export const login = async (username, password) => {

	try
	{
		// Store token in local storage
		const token = await api.request('POST', '/login')({ username, password })()
		localStorage.setItem('token', token)
	}
	catch (err)
	{
		alert('Wrong username and/or password')
	}
}
```