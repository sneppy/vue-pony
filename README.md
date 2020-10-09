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

In order for _vue-pony_ to work correctly, you'll need to configure the API endpoints in the following way:

- endpoints must be organized on a **resource-basis** (e.g. `/user`, `/post`, etc.);
- each entity is uniquely identified by **one or more aliases** (simple or composite, string or numeric keys; e.g. `user[1]` or `user[sneppy]`, `post[some-post-slug]` or `post[User[1], 2]`). Use **route parameters** to identify an entity on the API interface (e.g. `/user/1`, `/post/1`, etc.);
- follow **CRUD principles** (ideally you should define **C**reate, **R**ead, **U**pdate and **D**elete endpoints for each resource).

Next, you'll need to set up the client. First, create a `Pony` instance:

```javascript
let api = new Pony({
	base: 'http://localhost/api'
})
```

In the constructor you must specify the base URL of the API.

For the sake of this example, we'll assume you have a simple API with two types of entities - users and posts.

For each entity, you should define (and export) a class that extends `api.Model`:

```javascript
export class User extends api.Model
{

}

export class Post extends api.Model
{

}
```

This alone already allows you to fetch users and posts using `Model.get(...alias)`:

```javascript
let user = User.get(1)
let post = Post.get('introduction-to-vue-pony-d5f')
```

The `...alias` argument must form a valid entity alias (in most cases it will be a simple numeric ID). _vue-pony_ composes the alias to form the **entity URI**, which by default is `/<lowercase class>/<join ...alias with '/'>` (in the example above, `/user/1` and `/post/introduction-to-vue-pony-d5f`).

Entity-to-entity relationships can be defined using static properties/getters. In our simple API, we have one single relationship between users and posts:

```javascript
export class User extends api.Model
{
	static get posts()
	{
		return api.Set(Post)
	}
}

export class User extends api.Model
{
	static author = User
}
```

As you can see the relationship is actually split in two different static properties.

The name of the static property defines how the relationship can be accessed from the entity. To define a **\*-to-one** relationship you simply set the value of the static property to the class itself (e.g. since the author of a post is a user, the value must be `User`); if instead you need to define a **\*-to-many** relationship you must wrap the class with `api.Set(Type)`.

Entity properties and relationships can be accessed like normal properties:

```javascript
let post = Post.get(1)

console.log(post.title)
console.log(post.author.username)
```

Keep in mind, though, that it may take a while before the entity data is fetched. Many factory methods, such as `Model.get`, are synchronous, in that they return the entity before the HTTP request is actually fullfilled (rahter than, for instance, returning a promise that resolves with the fetched entity).

As a consequence, any property accessed before that time will return `undefined`. However, since the entity data is reactive, you can leverage Vue reactivity to overcome this problem.

Make sure to take a look at the [_vue-pony_ Guide](https://sneppy.github.io/vue-pony/).