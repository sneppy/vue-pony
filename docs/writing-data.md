[< Reading data](./reading-data)

---

# Writing data

In this section we'll see how to create new entities and how to delete or update an existing entity.

- [Writing data](#writing-data)
	- [Creating entities](#creating-entities)

Creating entities
-----------------

We can create new entities using `Model.create(params)`:

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

As with entity fetch methods, the create method is synchronous and returns the created entity before the request is actually fullfilled.
