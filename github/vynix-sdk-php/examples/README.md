# Example

A minimal example for Vynix PHP SDK.

Get your project key from [https://vynix.in](https://vynix.in), then:

```php
<?php
use Vynix\Client;

$vynix = new Client('YOUR_PROJECT_KEY');
$annotations = $vynix->annotations()->list();
```

See the [README](../README.md) for full setup, and the [Vynix docs](https://vynix.in/docs) for the API reference.
