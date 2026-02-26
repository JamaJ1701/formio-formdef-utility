# Analyzer Checks Reference

This document is the canonical list of analysis checks performed by the Form Definition Analyzer.

## Form.io applicability summary

Status against `formiojs` source:

- ✅ Applicable (first-class in Form.io):
    - `conditional.when`, `conditional.conditions[]`, `conditional.json`, `customConditional`
    - `logic[].trigger.{simple|javascript|json}` and `logic[].actions[]`
    - `validate.custom`, `calculateValue`, `customDefaultValue`
    - `redrawOn` (commonly available), and nested schema containers (`components`, `columns`, `rows`, `tabs`)
- ⚠️ Applicable but component-dependent:
    - `refreshOn` (primarily on data-driven components such as Select, not universal)
    - `data.custom`, `data.filter`, `data.url` (only on components that support remote/custom data sources)
- ⚠️ Heuristic (not full Form.io expression parsing):
    - Script extraction uses regex patterns for `data.*` / `row.*` / `submission.data.*`
    - JSON logic extraction supports object/array values and attempts safe parsing when `json` / `jsonLogic` is a JSON string
    - Script extraction includes common component lookup APIs (`instance.root.getComponent('key')`, `this.root.getComponent('key')`, `root.getComponent('key')`, `form.getComponent('key')`)
    - Full JavaScript semantics are not executed; dynamic/computed key lookups can still be missed

## Why this location

- It is colocated with implementation in `src/utils/analyzer/*`, so updates to logic and docs can happen together.
- It is easy for AI tools to discover via local code search near the analyzer modules.
- It avoids drift caused by keeping behavior docs in disconnected product docs.

## Analysis pipeline

Main entry point: `src/utils/analyzeDefinition.js`

1. Parse and shape validation for raw JSON.
2. Traverse and index components by schema path.
3. Run component validation checks.
4. Run duplicate key checks.
5. Build the hierarchical component tree.
6. Detect typed cross-component connections.
7. Aggregate stats for UI.

---

## 1) Input / form-level checks

Source: `src/utils/analyzeDefinition.js`

- `root.emptyInput`
    - Condition: input string is blank.
    - Error: `Paste a form definition to analyze.`
- `root.invalidJson`
    - Condition: `JSON.parse` throws.
    - Error: `Invalid JSON: ...`
- `root.invalidRootType`
    - Condition: parsed value is not an object or is an array.
    - Error: `Form definition must be an object.`
- `components.missingArray`
    - Condition: `parsed.components` is not an array.
    - Error: `Form definition must include a components array.`
- `components.empty`
    - Condition: components array exists but has zero items.
    - Error: `No components found in the form definition.`

---

## 2) Component validation checks

Source: `src/utils/analyzer/validation.js`

- `component.missingType`
    - Condition: component has no `type`.
    - Error: `Missing component type.`
- `component.inputMissingKey`
    - Condition: component has `input === true` but no `key`.
    - Error: `Input component is missing a key.`
- `component.missingLabelAndKey`
    - Condition: component has neither `label` nor `key`.
    - Error: `Component needs a label or key for clarity.`

---

## 3) Duplicate key checks

Source: `src/utils/analyzeDefinition.js`

- `component.duplicateDataPath`
    - Condition: more than one component resolves to the same effective submission data path.
    - Error pattern: `Duplicate data path "{dataPath}" found in {n} components...`
    - Error path: comma-separated schema paths.

Notes:

- Duplicate checking is scope-aware (Form.io-style). Same raw `key` can be valid when components are under different data-scoping containers.
- Data-scoping behavior mirrors Form.io conventions used in component traversal (for example, data containers like `container`, `datagrid`, `editgrid`, or `tree` components affect child data paths).

---

## 4) Component tree construction

Sources:

- `src/utils/analyzer/traverse.js`
- `src/utils/analyzer/tree.js`

Behavior:

- Tree is built recursively from the raw schema (not flattened key paths).
- Nested children are traversed from:
    - `components`
    - `columns[].components`
    - `rows[][].components`
    - `tabs[].components`
- Node identity/path format is schema-index based (example: `components[0].columns[1].components[2]`).

---

## 5) Connection detection checks

Source: `src/utils/analyzer/connections.js`

Detected output:

- `connections[]`: resolved links (`sourcePath` -> `targetPath`) with `connectionType`.
- `unresolved[]`: references to keys not present in the indexed component catalog.
- `stats`: counts by type and totals.

### 5.1 Explicit checks

- `conditional:simple`
    - `component.conditional.when`
- `conditional:conditions`
    - `component.conditional.conditions[].component`
- `conditional:json`
    - `component.conditional.json` (JSON logic variable extraction)
- `conditional:customJavascript`
    - `component.customConditional`
- `calculation:calculateValue`
    - `component.calculateValue`
- `default:customDefaultValue`
    - `component.customDefaultValue`
- `validation:custom`
    - `component.validate.custom`
- `dependency:refreshOn`
    - `component.refreshOn`
- `dependency:redrawOn`
    - `component.redrawOn`
- `data:custom`
    - `component.data.custom`
- `data:filter`
    - `component.data.filter`
- `data:url`
    - `component.data.url`
- `logic:trigger:simple`
    - `component.logic[].trigger.simple.when`
- `logic:trigger:conditions`
    - `component.logic[].trigger.simple.conditions[].component`
- `logic:trigger:javascript`
    - `component.logic[].trigger.javascript`
- `logic:trigger:json`
    - `component.logic[].trigger.json`
- `logic:action:component`
    - `component.logic[].actions[].component`
- `logic:action:value`
    - `component.logic[].actions[].value` (string script)
- `logic:action:valueJson`
    - `component.logic[].actions[].value` (object/json logic)
- `logic:action:propertyValue`
    - `component.logic[].actions[].property.value`

### 5.2 Recursive fallback checks

The detector also recursively scans unknown/nested objects and applies generic extraction:

- Direct key field match on string values:
    - `direct:refreshOn`
    - `direct:redrawOn`
    - `direct:when`
    - `direct:component`
- Script extraction on string values for field names:
    - `script:customConditional`
    - `script:calculateValue`
    - `script:customDefaultValue`
    - `script:custom`
    - `script:filter`
    - `script:url`
    - `script:template`
    - `script:javascript`
- JSON logic extraction for keys named:
    - `json:json`
    - `json:jsonLogic`

### 5.3 Script reference extraction patterns

Supported key-reference patterns in script-like text:

- `data.someKey`, `row.someKey`, `submission.data.someKey`
- bracket access: `data['someKey']`, `row["someKey"]`
- template forms with `{{ ... }}`
- `instance.getValue('someKey')`
- component lookup APIs: `instance.root.getComponent('someKey')`, `this.root.getComponent('someKey')`, `root.getComponent('someKey')`, `form.getComponent('someKey')`

Only references to known component keys are resolved into `connections`; unknown keys become `unresolved`.

### 5.4 Form.io compatibility notes

- `customConditional`, `calculateValue`, and `customDefaultValue` in Form.io can be authored in ways beyond simple string snippets (including advanced modes). Current detection focuses on string/script patterns.
- `conditional.json` and `logic[].trigger.json` are modeled as JSON logic by Form.io; if these are serialized as strings in a schema, detection may miss internal `var` references.
- Some components expose additional dynamic behaviors (for example, data-source-specific interpolation) that may create implicit dependencies not represented as explicit key references.
- This analyzer is intentionally conservative: it avoids executing user expressions and only extracts static references.

---

## 6) Stats produced

Source: `src/utils/analyzeDefinition.js` and `src/utils/analyzer/connections.js`

- `stats.total`: number of indexed components
- `stats.display`: form display mode (`parsed.display`)
- `stats.totalConnections`: resolved connection count
- `stats.connectionTypes`: number of unique connection types
- `stats.connectionTypeCounts`: per-type connection counts

---

## 7) Coverage gaps (current)

This section tracks known analyzer blind spots and recommended next steps.

### High priority

- Additional nested schema containers
    - Gap: traversal currently covers `components`, `columns`, `rows`, and `tabs` only.
    - Suggested approach: extend traversal for any additional Form.io nested structures encountered in real definitions and document each added path.

### Medium priority

- Event-based logic references
    - Gap: `logic[].trigger.type === 'event'` is recognized as logic config but does not map to component-to-component edges.
    - Suggested approach: emit explicit `logic:trigger:event` records as non-component dependencies (event name metadata) so they are visible in analysis.

- Data-source interpolation coverage
    - Gap: URL/filter/custom script extraction is regex-based and may miss uncommon interpolation/function styles.
    - Suggested approach: expand script patterns for frequent Form.io idioms observed in production schemas.

### Low priority

- Connection confidence metadata
    - Gap: all detected links are presented uniformly even when derived heuristically.
    - Suggested approach: add confidence levels (for example, `explicit`, `derived-regex`, `derived-jsonlogic`) to improve review quality.

- Config toggles for strictness
    - Gap: analyzer behavior is fixed; teams cannot choose strict vs permissive extraction.
    - Suggested approach: add analyzer options to enable/disable heuristic fallback scans.

---

## Maintenance rule

When adding/changing analyzer behavior, update this file in the same PR/commit.
