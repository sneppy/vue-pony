[< Introduction](./index)

---

# Reading data

In this section we see how we can use _vue-pony_ to fetch entities from the API and how to access its properties and its relationships.

- [Reading data](#reading-data)
	- [Fetching entities](#fetching-entities)
		- [Data centralization and aliases](#data-centralization-and-aliases)
	- [Data reactivity](#data-reactivity)
	- [Waiting for data](#waiting-for-data)

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
console.log(user.username) // -> undefined
```

> We'll see later how to deal with this problem. For the moment being, let's presume that any HTTP request fullfills instantly.

To allow for greater flexibility, a model may also be fetched using `Model.fetch(uri)`, which accepts a URI string as parameter:

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

One-to-many relationships, defined using `api.Set`, return an instance of `api.Set` when accessed, which is merely a wrapper around a list of keys.

Sets can be iterated:

```javascript
for (let post in User.get(1).posts) console.log(post.title)
```

> When iterating a set, _vue-pony_ will automatically fetch each entity using the i-th key.

We can also access a specific model, like we would in a normal array:

```javascript
let post = User.get(1).posts[0] // First user post
```

The similarity with normal arrays don't end here. As with arrays, `_length` returns the number of items in the set:

```javascript
let numPosts = User.get(1).posts._length
```

And we can use `_map(mapping)`, like we would on a normal array:

```javascript
let titles = User.get(1).posts._map((p) => p.title)
```

A set can be converted to an array, either using the spread operator or with `_array`:

```javascript
let arr = [ ...User.get(1).posts ]
// or
let arr = User.get(1).posts._array
```

Sometimes you may wish to access the entity raw data. To do so, use `__data__`:

```javascript
console.log(post.__data__.author) // Author's id, rather than the entity
```

More rarely you will find youself in need to access the list of keys in a set. If you wish to do so, you may use `__indices__`:

```javascript
console.log(user.posts.__indices__) // Raw list of post ids (e.g. [1, 5, 10, 11])
```

You can refresh the local data anytime using `_update(force = false)`:

```javascript
post._update()
```

If `force` is set, the entity will be updated even if the data is still fresh, otherwise it will be updated only if the local data is considered outdated.

### Data centralization and aliases

All data in _vue-pony_ is centralized. Before fetching an entity, _vue-pony_ checks if the store already contains a data record tagged with the requested uri; if it exists, it returns that record and proceeds to udpate it if necessary; if the record doesn't exist, it creates a new one.

As a consequence, if we fetch `/user/1` in point A, and then fetch the same entity in point B, the two instances will share the same `__data__` object. Therefore, any change made to either instance will immdediately be reflected on the other entity. In other words, data in _vue-pony_ is centralized, even though it doesn't seem like it.

However, in some cases this system may break, in particular when a single entity can be referenced with multiple keys (e.g. `/user/1`, `/user/charlie` and `/user/charlie.brown@sneppy.com` refer to the same entity).

Fortunately, _vue-pony_ is able to realize that two instances refer to the same entity by checking the primary key `_pk`:

```javascript
console.log(User.get(1)._pk, User.get('charlie')._pk, User.get('charlie.brown@sneppy.com')._pk) // -> [1], [1], [1]
```

In which case, it creates an alias for the non-primary URIs.

> There are still some corner cases where the system will break. I'm looking for a method to fix this.

Data reactivity
---------------

In the real world, it may take a while before the request is fullfilled. In the meantime, if you try to read the value of any property you will get `undefined`. That's because `__data__` is still empty!

Fortunately, _vue-pony_ is designed with Vue in mind, and thus it can make use of its amazing reactive capabilities. The data of an entity is made reactive by default, which means that we can use Vue watchers and computed values to react to changes:

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

Waiting for data
----------------

Reacting to changes in data works very well with Vue. However, sometimes you may prefer to be notified when the data is ready, and execute some sort of callback. For instance, you may want to wait for data to be available before entering a route.

We can use `_wait(event = 'ready', what = identity)`, on both entities and sets, to wait for an arbitrary data event:

```javascript
let user = User.get(1)
user._wait('ready').then((u) => console.log(u.username)) // -> charlie
```

The first parameter is a string that identifies the event, which can either be `'ready'`, `'update'` or `'delete'`. An update event is triggered when the data is updated (only by a request). The ready event is triggered when an update occurs and the data is ready (i.e. non-zero status). It is often the case that the two events coincide.

> At the moment being, entity deletion is not yet implemented.

the second parameter is a transform callback, which takes the entity as parameter:

```javascript
user._wait('ready', (u) => u.username).then(console.log) // Equivalent to above, really a matter of preference
```

Using `async/await` makes it relatively easy to wait for a full-chain of entities:

```javascript
async () => {

	let user = await User.get(1)._wait()
	let posts = await user.posts._wait()
	let firstPost = await posts[0]._wait()
}
```

But let's be honest, this code is an abomination! Fortunately, I thought about that.

Instead of using `_wait`, you can use `api.wait(...exprs)`:

```javascript
api.wait(() => user.posts[0].author.email).then(console.log) // -> charlie.brown@sneppy.com
```

You can provide one or more expressions. If you provide multiple expressions, the promise will resolve with an array of outputs:

```javascript
api.wait(() => user.posts[0].title, () => user.posts[1].title).then(([ first, second ]) => { /* ... */ })
```

`api.wait` works by forcing the entity to encapsulate each property accessed in a promise, which means that each property is actually a proxied promise. As a consequence, not every operation is allowed inside `api.wait`; a few examples:

- entity and set methods cannot be called:

	```javascript
	api.wait(() => user.posts.map((p) => p.title)) // -> TypeError: user.posts.map is not a function.
	```

- sets cannot be spread:

	```javascript
	api.wait(() => [ ...user.posts ]) // -> TypeError: Invalid attempt to spread non-iterable instance.
	```

- entities, set and properties cannot be passed as arguments:

	```javascript
	let post = Post.get(1)
	api.wait(() => Post.get(post)) // I know, it's not a very clever example!
	```

We can use `async/await` to overcome this limitations:

```javascript
api.wait(async () => {

	// Spread set example
	return [ ...(await user.posts._self) ]
})
```

Needless to say that it defies the main purpose of `api.wait` in most cases.

Moreover, since `api.wait` works with property encapsulation, if you don't access any property nothing really happens:

```javascript
api.wait(() => User.get(1)).then((u) => console.log(u.username)) // -> undefined
```

This happens in general when the chain terminates with an entity or set, i.e. `post.author`, `user.posts[0]`, etc. In this cases you must use `_self` to force encapsulation:

```javascript
api.wait(() => User.get(1)._self).then((u) => console.log(u.username)) // -> charlie
```

You may also nest multiple calls to `api.wait`:

```javascript
api.wait(async () => {

	// This must be outside the nested `api.wait`
	let titles = (await user.posts._self).map((p) => () => p.title)

	return await api.wait(...titles)
})
```

---

[Writing data >](./writing-data.md)
