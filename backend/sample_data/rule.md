 ## Rule Schema Explanation

### 🔧 MatchType Supported Values

You can use the following `MatchType` options to control how values are matched during extraction, filtering, or reconciliation:

* `equals`: Match exact value.
* `contains`: Value contains a substring.
* `not_contains`: Value does **not** contain a substring.
* `startswith`: Value starts with a substring.
* `endswith`: Value ends with a substring.
* `regex`: Apply a regular expression pattern.
* `greater_than`: Numeric comparison where value must be greater than the specified value.
* `less_than`: Numeric comparison where value must be less than the specified value.
* `in`: Value is one of the specified values.
* `not_in`: Value is **not** one of the specified values.
* `tolerance`: Used for numeric reconciliation allowing a delta difference (e.g., +-10).

---

### 🧠 Optional Future Fields for Rule Extensibility

To support complex use cases and future enhancements, the schema may include the following optional fields:

* `CaseSensitive`: `true` or `false` — controls whether string comparisons are case-sensitive.

* `Negate`: Allows logical inversion of a match condition. E.g., `Negate: true` with `equals: "X"` will act like `!= "X"`.

* `Logic`: Used to combine multiple filter conditions.

  * `AND`: All conditions must match.
  * `OR`: Any condition can match.

* `ApplyToRows`: Controls how to apply rules across rows.

  * `all`: Rule must match **all** rows.
  * `any`: Rule must match **at least one** row.
  * `first`: Apply the rule to the first matching row.
  * `custom script`: Allows injecting custom logic for evaluation (advanced use).

This flexible rule structure allows the system to be dynamic, extensible, and capable of handling a wide variety of real-world data processing scenarios.
