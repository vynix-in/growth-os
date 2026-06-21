# Example

A minimal example for Vynix JavaScript SDK.

Get your project key from [https://vynix.in](https://vynix.in), then:

```js
import { Vynix } from '@vynix/sdk';

const vynix = new Vynix({ projectKey: 'YOUR_PROJECT_KEY' });
const notes = await vynix.annotations.list();
```

See the [README](../README.md) for full setup, and the [Vynix docs](https://vynix.in/docs) for the API reference.
