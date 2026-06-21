# Example

A minimal example for Vynix GitHub Action.

Get your project key from [https://vynix.in](https://vynix.in), then:

```yaml
- name: Vynix
  uses: vynix-in/vynix-github-action@v1
  with:
    project-key: ${{ secrets.VYNIX_PROJECT_KEY }}
```

See the [README](../README.md) for full setup, and the [Vynix docs](https://vynix.in/docs) for the API reference.
