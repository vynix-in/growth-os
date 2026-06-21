# Example

A minimal example for Vynix Python SDK.

Get your project key from [https://vynix.in](https://vynix.in), then:

```python
from vynix import Vynix

vynix = Vynix(project_key="YOUR_PROJECT_KEY")
for note in vynix.annotations.list():
    print(note.title)
```

See the [README](../README.md) for full setup, and the [Vynix docs](https://vynix.in/docs) for the API reference.
