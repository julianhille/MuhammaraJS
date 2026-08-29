# Migrate From Recipe Modules

MuhammaraJS bundles the high-level Recipe API. Replace imports from either
`hummus-recipe` or `muhammara-recipe` with `Recipe` from MuhammaraJS.

```javascript
var Recipe = require("muhammara").Recipe;
```

The constructor and chainable Recipe API remain available through this export.
See [High-Level Recipe](../recipe/index.md) for creation, modification,
composition, encryption, and the generated API reference.
