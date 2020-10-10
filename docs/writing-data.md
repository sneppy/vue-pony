[< Reading data](./reading-data)

---

# Writing data

In this section we'll see how to create new entities and how to delete or update an existing entity.

- [Writing data](#writing-data)
	- [Creating entities](#creating-entities)
	- [Deleting entities](#deleting-entities)
	- [Updating entities](#updating-entities)

Creating entities
-----------------

We can create new entities using `Model.create(params, uri)`:

```javascript
let post = Post.create({
	username: 'linus',
	email: 'linus.vanpelt@sneppy.com',
	name: 'Linus Van Pelt'
})
```

The client will send a `POST` request at `/<index>` with the provided creation parameters `params` in JSON form:

```http
POST /post

{
	"username": "linus",
	"email": "linus.vanpelt@sneppy.com",
	"name": "Linus Van Pelt"
}
```

We expect the API to respond with `201 CREATED` and the created entity data.

In the event that you need to send the request to a different URI, you can provide a second parameter to `Model.create`:

```javascript
let post = Post.create({ ...params }, `/user/_new`)
```

As with entity fetch methods, the create method is synchronous and returns the created entity before the request is actually fullfilled. You may use `_wait` or `api.wait` to wait for data.

If the entity created is to belong to a set, you may call `_create(params, uri)` on the set itself to create a new entity:

```javascript
user.posts._create({ ...params })
```

By default, a `POST` request with the creation parameters will be sent to `<owner uri> + /<index>`:

```http
POST /user/1/post

{
	...params
}
```

> This is true only for sets spawned from a one-to-many relationship.

You may provide the second parameter `uri` to change the default URI.

When creating an entity from a set, that entity will automatically be added to the set once the request has been fullfilled, so that you don't have to worry about keeping the set update (locally).

Deleting entities
-----------------

Deleting an entity is very easy, you simply call `_delete(uri)` on the entity itself:

```javascript
post._delete()
```

As with `_create`, you may specify a URI if it differs from the entity URI.

However, unlike `_create`, `_delete` is fully asynchronous, which means that it returns a promise that resolves (with nothing) when the delete request is fullfilled:

```javascript
post._delete().then(() => console.log('deleted'))
```

If that entity (any instance of that entity) belongs to a set, it is automatically removed from the set. That's pretty awesome in my opinion.

Updating entities
-----------------

In _vue-pony_ there are two ways to update an entity.

You can use `_put(data = {}, uri)` to send a `PUT` request. The entity data is merged with the data provided and sent along with the request.

This allows you to either directly modify the local copy of the entity, or keep the changes separate and inject them right before sending the request:

```javascript
user.username = 'linus' // Overwrites local data
user._put({
	email: 'linus.vanpelt@sneppy.com' // Not visible locally, but sent in the request
})
```

Unless `uri` is provided, the request is sent at the entity URI.

As with `_delete`, this method returns a promise that resolves when the request is fullfilled.

In _vue-pony_ you can also use `_patch(doPatch, uri)` to "patch" the entity, i.e. partially update its data. `_patch` works by setting the entity record in **patch mode**, in which it keeps track of which properties are written:

```javascript
post._patch(() => {

	post.title = 'New title'
	post.author = User.get(2)
})
```

If `doPatch` is undefined, a `PATCH` request will be sent to the entity URI (unless `uri` was specified) with only the modified properties:

```http
PATCH /post/1

{
	"title": "New title",
	"author": 2
}
```

You can also send the request by calling the first parameter of `doPatch`:

```javascript
post._patch((patch) => {

	post.title = 'New title'
	post.author = User.get(2)

	// Send PATCH request
	patch()
})
```

In any case, `_patch` returns a promise that resolves when the request is fullfilled. If no request is sent you can simply ignore its return value.

> Patch is very flexible, and potentially allows you to discard the changes and revert to the original data. This functionality will probably be added in the future.

Both `PUT` and `PATCH` requests should return the updated entity data.
