# vue-pop

**vue-pop** is a intuitive and easy to use interface to interact with your REST API.

> DISCLAIMER: I develop this project for my personal use. I won't generally be accepting any pull request and I'm not going to actively look into open issues. You are free to use this package as-is if you like it.

Usage example
-------------

General usage

```javascript
import Pony from 'vue-pony'

export const api = new Pony({
	host: 'https://api.your.io'
})

/**
 * Define a new class that extends
 * base model
 */
export class User extends api.Model
{
	// That's it really
}

/**
 * 
 */
export class Post extends api.Model
{
	// Use static methods to define
	// entity-to-entity relationships
	static author = User
}

// Fetch post by id
Post.fetch(1).then((post) => {

	// This returns an empty instance
	// that will be filled, and it is
	// fully reactive
	let user = post.user

	// Use `.wait()` to wait for it
	user.wait().then((user) => console.log(user.username))
})
```

Inside a Vue component:

```javascript
import { computed }
import { User } from '@/api'

export default {
	name: 'User',

	props: {
		userid: {
			type: Number,
			required: true
		}
	}

	setup(props) {

		// User as computed property
		let user = computed(() => User.get(props.userid)/* Sync request */)

		// Initially it will be empty, use `.isValid()` to check
		return { user }
	}
}
```

Read the [documentation]() for further details.