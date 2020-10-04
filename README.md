# vue-pony

> An intuitive and elegant library for interfacing with your REST API

**vue-pony** is an intuitive and elegant library that can handle most client-server interactions out of the box. It flavors an object-oriented syntax inspired by [Pony ORM](https://ponyorm.org/), an awesome Python ORM library.

> Note that I develop _vue-pony_ for personal use. I won't be actively looking into issues and pull requests.

Collaborators
-------------

- Andrea Mecchia @ [sneppy](https://github.com/sneppy)

Install
-------

You may install _vue-pony_ with NPM:

```console
$ npm i -S @sneppy/vue-pony
```

> This branch hosts the version 2.x of _vue-pony_. For version 1.x, you should use `npm i -S @sneppy/vue-pony@1`

Usage
-----

In order for _vue-pony_ to work correctly, you should configure your REST API endpoints in the following way:

- organize your endpoints on a resource-basis (e.g. `/user/..`, `/post/..`, etc.);
- use route parameters (e.g. `/user/1`, `post/1` rather than `/user?id=1`);
- don't embed external resources (e.g. `/post/1` should not return author's data, but rather a key to identify the user);

In a separate file, import and create a new instance of `Pony`:

```javascript
/** @file api.js */

import Pony from '@sneppy/vue-pony'

export const api = new Pony({
	base: 'http://localhost/api' // Base URL
})
```

For each resource type, create a new class that extends the base class `api.Model`:

```javascript
export class User extends api.Model
{

}

export class Post extends api.Model
{

}

export class Comment extends api.Model
{

}
```

Each model maps a resource type, identified by the lowercase class name (e.g. `User -> user`, `Post -> post`, `Comment -> comment`).

To fetch an entity, use `Model.get(...alias)`:

```javascript
import { User, Post, Comment } from './api'

// Get user with id 1
let user = User.get(1)
```

Which translates to the following HTTP request:

```console
GET /user/1
```

The server must respond with the user data in JSON format:

```json
{
	"id": 1,
	"username": "charlie",
	"email": "charlie.brown@peanuts.com",
	"name": "Charlie Brown"
}
```

Since the request is asynchronous, it will take a while before the entity is populated. Once the entity has been populated, we can normally access its properties:

```javascript
console.log(user.username, user.email)
```

Data is stored in a reactive store, therefore we can leverage Vue reactivity to wait for data to be available:

```javascript
import { watchEffect } from 'vue'

let post = Post.get(1)

watchEffect(() => {

	// Wait for data
	if (post._status === 200)
	{
		console.log(post.title)
	}
})
```

The `_status` property is the HTTP status of the response or `0` if the request is pending.

### Entity relationships

Entity relationships are defined with static properties. Out REST API has the following relationships:

- each `Post` is authored by a single `User`;
- each `User` has a set of `Post`s;
- each `Comment` is authored by a single `User` and refers to a single `Post`;
- each `Post` has a set of `Comment`s;
- each `User` has a set of `Comment`s

In _vue-pony_ we describe relationships like this:

```javascript
export class User extends api.Model
{
	// Set of posts
	static get posts()
	{
		return api.Set(Post)
	}

	// Set of comments
	static get comments()
	{
		return api.Set(Comment)
	}
}

export class Post extends api.Model
{
	// Post author
	static author = User

	// Set of comments
	static get comments()
	{
		return api.Set(Comment)
	}
}

export class Comment extends api.Model
{
	// Comment author
	static author = User

	// Comment post
	static post = Post
}
```

> Static getters are only necessary when they precede the definition of the class itself. We would use `static posts = api.Set(Post)` in `User` if `Post` was defined before `User`.

A relationship is accessed like any normal javascript property and it either returns an entity or a set of entities:

```javascript
let user = User.get(1)
let post = Post.get(3)
let posts = computed(() => user.posts)
let author = computed(() => post.author)
watchEffect(() => console.log(author.username, author.email))
```

A single-entity relationship, such as `static author = User` is equivalent to the following getter:

```javascript
get author()
{
	return User.get(this.__data__['author'])
}
```

A set relationship such as `api.Set(Post)` in `User`, sends a `GET` request to `/user/<_pk>/post`. The endpoint must return a list of indices of posts:

```json
[1, 3, 7, 8, 11]
```

A set can be iterated:

```javascript
for (let post in user.posts) console.log(post.title)
```

We can also access the i-th entity like we would in a normal array:

```javascript
console.log(user.posts[0].title)
```

Just keep in mind that all requests are asynchronous.

### Authorization

Most API requests require some sort of authorization. For example, after the user authenticates itself, all subsequent requests should bear a token, but another API may use a different authorization method.

In order to authorize requests, you may provide a callback when creating the `Pony` instance. This callback receives the xhr request, an `XMLHttpRequest` object:

```javascript
const authorize = (xhr) => {

	// Get bearer token from local storage
	const token = localStorage.getItem('token')
	if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token)
}

let api = new Pony({
	base: 'http://localhost/api',
	authorize
})
```

_vue-pony_ does not have directly handle authentication. You may use any method to authenticate the user (for example store the token in `localStorage` after login).

### Arbitrary requests

You can also perform arbitray requests using `request(method, uri, params = {}, headers = {})` to create a request dispatcher:

```javascript
// Some request not handled by vue-pony
let req = api.request('GET', '/notifications')

// Dispatch request
req().then(([ notifications ]) => console.log(notifications))
```

The request dispatcher accepts a single `data` parameter and returns a promise that resolves with a 3-items array:

```javascript
// Provide data for POST, PUT and other requests
let res = await req(data)

// Use unpacking to get response body, status or the xhr object itself
let [ body, status, xhr ] = res
let [ body ] = res
let [ , status ] = res
let [ , , xhr ] = res
```

### Advanced usage

Take a look [here](https://sneppy.github.io/vue-pony/)