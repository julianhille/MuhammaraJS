# Migrate From HummusJS

MuhammaraJS is a drop-in replacement for the discontinued HummusJS package. To
migrate the low-level API, change the module import:

```javascript
var muhammara = require("muhammara");
```

For `hummus-recipe` or `muhammara-recipe`, see
[Migrate From Recipe Modules](migrate-from-recipe-modules.md).
