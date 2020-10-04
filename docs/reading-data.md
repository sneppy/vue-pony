[< Introduction](.)

---

# Reading data

In this section we see how we can use _vue-pony_ to fetch entities from the API and how to access its properties and its relationships.

- [Reading data](#reading-data)
	- [Fetching entities](#fetching-entities)
	- [Data reactivity](#data-reactivity)

Fetching entities
-----------------

The easiest way to fetch an entity is with `Model.get(...alias)`:

```javascript
let user = User.get(1)
```

`Model.get` will send a `GET` request at the entity URI (e.g. at `Model.uri([ ...alias ])`) and return the entity object.

The peculiarity of `Model.get` is that the function itself is synchronous, in that it returns the entity rather than a promise, as is usually the case. However, the request sent to the server is asynchronous, which means that the entity data will be populated only when the request is fullfilled.

As a consequence, trying to access any property of the entity will return `undefined`:

```javascript
console.log(user.username) // -> 'undefined'
```

> We'll see later how to deal with this problem. For the moment being, let's presume that any HTTP request fullfills instantly.

To allow for greater flexibility, a model may also be fetched using `Model.fetch(uri)`, which accepts a relative URI as parameter:

```javascript
let user = User.fetch(`/user/1`)
```

Once we fetch an entity with `Model.get`, we can normally access its properties:

```javascript
let user = User.get('charlie')
console.log('Welcome back, ' + user.name + '!')
```

We can also access relationships:

```javascript
let post = Post.get(1)
console.log('Post #' + post.id + ' written by ' + post.author.username)
```

One-to-many relationships, defined using `api.Set`, return an instance of `api.Set` when accessed.

A set is merely a wrapper around a list of keys. Sets can be iterated:

```javascript
for (let post in User.get(1).posts) console.log(post.title)
```

When iterating a set, _vue-pony_ will automatically fetch each entity using the i-th key.

We can also access a specific model, like we would in a normal array:

```javascript
let post = User.get(1).posts[0] // First user post
```

Sometimes you may wish to access the entity raw data. To do so, use `__data__`:

```javascript
console.log(post.__data__.author) // Author's id, rather than the entity
```

More rarely you will find youself in need to access the list of keys in a set. If you wish to do so, you may use `__indices__`:

```javascript
console.log(user.posts.__indices__) // Raw list of post ids (e.g. [1, 5, 10, 11])
```

Data reactivity
---------------

In the real world, it may take a while before the request is fullfilled. In the meantime, if you try to read the value of any property you will get `undefined`. That's because `__data__` is still empty!

Fortunately, _vue-pony_ is designed with Vue in mind, and thus it makes use of its amazing reactive capabilities. The data of an entity is reactive, which means that we can use Vue watchers and computed values to react to changes:

```javascript
// No need to `ref` or `reactive` an entity
let user = User.get(1)

// Log username and email
watchEffect(() => console.log(user.username))

// Compute user's posts
let name = computed(() => user.name)
```

It is also straightforward to use entities in Vue templates:

```html
<template>
	<div class="user-profile">
		<div class="username">{{ user.username }}</div>
		<div class="email">{{ user.email }}</div>
	</div>
</template>
```

Eventually, it will display the correct username and email.

Things get a bit more complicated with relationships, since they involve an additional request that (usually) depends on the entity's data. Whilst eventually it will fetch the correct entities, you will probably get lots of `400 NOT FOUND` responses.

That makes sense, since to fetch the author of a post we need to know its id, which initially is `undefined`, and `GET /user/undefined` doesn't exist.

If you care about your mental sanity, you may wish to wait until the first entity has done fetching. You can check the value of `_status` to determine whether an entity has done fetching:

```javascript
let user = User.get(1)
let posts = computed(() => {

	if (user._status === 200) // 200 OK
	{
		return user.posts
	}
	else return [] // Or return an empty api.Set(Post)
})
```

The `_status` property is the HTTP response status. Initially it has a value of `0` to indicate that the request is pending. You may also use `_status` to check for errors:

```javascript
let post = Post.get(11)
watchEffect(() => {

	if (post._status === 403) // 403 FORBIDDEN
	{
		console.error('You are not authorized to read this resource')
	}
})
```

---

[Writing data >](./writing-data.md)
