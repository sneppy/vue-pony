# Introduction

_vue-pony_ is an intuitive and elegant library for interfacing with your REST API. It uses an object-oriented syntax inspired by [PonyORM](https://ponyorm.org/), an awesome Python ORM library.

As the name suggests, _vue-pony_ was born as a [Vue](https://v3.vuejs.org/) plugin. However, it can easily be used as a standalone library.

> At the moment of writing this documentation, Vue is still listed as a dependency.

Index
-----

1. [Introduction](.)
   1. [Installation](#installation)
   2. [API configuration](#api-configuration)
   3. [Client setup](#client-setup)
   4. [Creating models](#creating-models)
      1. [Entity relationships](#entity-relationships)
2. [Reading data](./reading-data)
   1. [Fetching entities](./reading-data#fetching-entities)
      1. [Data centralization and aliases](./reading-data.md#data-centralization-and-aliases)
   2. [Data reactivity](./reading-data#data-reactivity)
   3. [Waiting for data](./reading-data#waiting-for-data)
3. [Writing data](./writing-data)
   1. [Creating entities](./writing-data#creating-entities)
   2. [Deleting entities](./wip)
   3. [Updating entities](./wip)
   4. [Updating sets](./wip)
4. [Reference](./wip)

Installation
------------

_vue-pony_ can be installed with NPM:

```console
$ npm i -S @sneppy/vue-pony
```

> To install the older version use this command instead:
>
> ```console
> $ npm i -S @sneppy/vue-pony@1
> ```

API configuration
-----------------

In order for _vue-pony_ to work you'll need to configure the API in the following way:

- API endpoints should be organized on a resource-basis (e.g. all user endpoints should start with `/user`, all post endpoints should start with `/post`, etc. In general each resource is assigned a subset of endpoints);
- each resource must have one or more keys used to uniquely identify that resource. Keys may be single (e.g. a simple numeric ID) or composite. A single resource may be referenced using multiple keys; for instance, a user may be referenced using its ID, its username (if unique) or its email address;
- API endpoints must use **route parameters** (e.g. `/user/1` or `/group/2/member6`); in particular, each resource should have an endpoint with the form `/<resource name>(/<key>)+` used to fetch, update and delete the resource. In general, the path of any operation that targets a resource should be a subpath of its base endpoint;

Throughout this guide we'll assume that a simple API exists, which consists of a set of users and a set of posts. A JSON representation of each resource is given below:

**user:**
```json
{
	"id": 1,
	"username": "charlie",
	"email": "charlie.brown@sneppy.com",
	"name": "Charlie Brown"
}
```

**post:**
```json
{
	"id": 1,
	"title": "Peanuts",
	"author": 1,
	"created": "1950-10-05T00:00:00+00:00",
	"content": "..."
}
```

> Note how `post.author` uses the `user.id` value to refer to the actual user resource.

Moreover, the following endpoints are defined:

| endpoint | description |
| -------- | ----------- |
| `GET /user/<alias>` | Returns user identified by `<alias>` (id, username or email) |
| `POST /user {params}` | Creates a new user from `{params}` and returns it |
| `GET /post/<postid>` | Returns post identified by `<postid>` |
| `POST /post {params}` | Creates a new post from `{params}` and returns it |
| `GET /user/<userid>/post` | Returns a list of indices of posts authored by user with id `<userid>` |

Client setup
------------

Somewhere in your project (it may be a good idea to create an `api.js` file in the `src` directory), import and create a new instance of `Pony`:

```javascript
import Pony from '@sneppy/pony'

export let api = new Pony({
	base: 'http://localhost/api'
})
```

The `Pony` constructor accepts an object parameter with the following properties:

- `base`: base URL, required;
- `authorize`: authorize callback, used to authorize outgoing requests. See [Authentication and authorization]() for more details.

Creating models
---------------

Each resource is associated to a client model, which is a class that extends `api.Model`. A model defines the prototype of a resource, its relationships with other entities and the resource endpoint configuration.

```javascript
export class User extends api.Model
{

}

export class Post extends api.Model
{

}
```

By default, an empty model maps a resource whose name is equal to the lowercase class name (e.g. `User -> user` and `Post -> post`). If the name of the resource differs from the lowercase class name, you can override `Model.index`  to change it:

```javascript
class User extends api.Model
{
	static get index()
	{
		return 'person'
	}
}
```

This index is used by `Model.uri(alias, path = '')` to generate the URI for a given entity. By default, this method appends the entity key after the index:

```javascript
console.log(Post.uri([1])) // -> '/post/1'
console.log(Post.uri(['post-slug-ef3']), '/commits') // -> '/post/post-slug-ef3/commits'
```

The optional `path = ''` argument is a string that is appended at the end of the URI.

If necessary, you can also override `Model.uri`. For example, assume that each post has a set of commits:

```javascript
export class PostCommit extends api.Model
```

A commit is uniquely identified by a composite key `<post, hash>`, where `post` is the id of the post it belongs to, and `hash` is the commit hash. Intead of having `commit/<post>/<hash>` (which is the default `Method.uri` output), you may prefer to use the URI `/post/<post>/commit/<hash>`, which is far more readable and highlights the fact that a commit belongs to that post:

```javascript
static uri([ postid, commithash ], path = '')
{
	return `/post/${postid}/commit/${commithash}`
}
```

> [Array destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment) was used above to destructure the `alias` parameter.

The entity index is also used by `Model.key(alias)` to generate a unique key for each entity, with the form `<index>:<key>`. The key generated by `Model.key` has no particular usage inside _vue-pony_ (you may use it, for instance, to key the items in a `v-for` loop).

```javascript
console.log(PostCommit.key(3, 'e55f6c')) // -> 'postcommit:3,e55f6c'
```

### Entity relationships

_vue-pony_ supports simple entity-to-entity relationships out of the box.

One-way relationships are defined using static properties (or getters if necessary) inside the model class. For instance, each post is authored (belongs to) a single user. We describe this relationship like this:

```javascript
export class Post extends api.Model
{
	// User that authored this post
	static author = User
}
```

The name of the static property determines both the name that we'll be used to access the relationship, and the name of the property of the entity data that has the user index. 

On the other side, each user has a set of posts. This type of one-way relationship is defined with `api.Set(Type)`, where `Type` must be a model:

```javascript
export class User extends api.Model
{
	// Set of posts authored by this user
	static posts = api.Set(Post)
}
```

If you try to define both relationships (two-way relationship), you will incur in a circular dependency problem: depending on which model is defined first, one of model will evaluate to `undefined` (e.g. if you first define `User`, then `Post` will be `undefined` in `api.Set(Post)`; viceversa, if you first define `Post`, `User` will be `undefined`).

To solve this problem, you must use a getter for the first relationship:

```javascript
export class User extends api.Model
{
	// Set of posts authored by this user
	static get posts()
	{
		// Evaluated only when `posts` is accessed
		return api.Set(Post)
	}
}

export class Post extends api.Model
{
	// User that authored this post
	static author = User
}
```

---

[Reading data >](./reading-data.md)
