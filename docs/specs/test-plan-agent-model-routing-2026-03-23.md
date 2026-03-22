# Test Plan — Agent Model Routing
March 23, 2026

## API Tests

### GET /mc/api/model-routing
- Returns routing config JSON when `shared/model-routing.json` exists
- Returns 404 with empty body when file doesn't exist
- Returns valid structure: `tiers` (object), `agents` (object), `research_phases` (object)

### PUT /mc/api/model-routing
- Writes valid config to `shared/model-routing.json`, returns 200
- Rejects config missing required keys (`tiers`, `agents`, `research_phases`)
- Rejects tier with invalid model string (must be `provider/model` format)
- Rejects tier with invalid thinking level (must be one of off|minimal|low|medium|high|xhigh|adaptive)
- Rejects agent mapped to non-existent tier name
- Rejects research phase mapped to non-existent tier name
- Full replace: previous config is completely overwritten, not merged

### POST /mc/api/issues (new fields)
- Accepts `model_override: null` (default)
- Accepts valid model override string (`"anthropic/claude-opus-4-6"`)
- Rejects invalid model override string (not provider/model format)
- Accepts `thinking_override: null` (default)
- Accepts valid thinking override (`"high"`)
- Rejects invalid thinking override (`"turbo"`)
- Accepts valid complexity (`"simple"`, `"complex"`, `"strategic"`)
- Rejects invalid complexity (`"extreme"`)
- `escalation_count` defaults to 0 if not provided
- Existing issue creation (without new fields) still works — backward compatible

### PATCH /mc/api/issues/:id (new fields)
- Can update `model_override` from null to a valid model
- Can update `model_override` back to null (clear override)
- Can update `thinking_override` independently
- Can update `complexity`
- Can update `escalation_count` (agents will do this in v2)
- Partial update: changing only `model_override` doesn't affect other fields
- Same validation rules as POST

## Frontend Tests (Manual)

### Routing Config page
- [ ] Page loads with empty state when no `model-routing.json` exists — shows "Configure routing" CTA
- [ ] Page loads and displays existing config when file exists
- [ ] Tier definitions: model dropdown shows available models, thinking dropdown shows valid levels
- [ ] Agent assignments: tier dropdown shows four tier options, resolved model displays next to each
- [ ] Research phases: tier dropdown works, resolved model displays
- [ ] Changing a tier definition updates the resolved model shown next to all agents/phases using that tier
- [ ] Save button is disabled when no changes have been made
- [ ] Save button writes to volume and shows success confirmation
- [ ] After save, refreshing the page shows the saved values

### Issue Create — model section
- [ ] Complexity dropdown appears with three options, defaults to Complex
- [ ] Model Override dropdown appears with Auto + three models, defaults to Auto
- [ ] Thinking Override dropdown is hidden when Model Override is Auto
- [ ] Thinking Override dropdown appears when Model Override is set to a specific model
- [ ] Setting Model Override shows indicator text ("This issue will run on...")
- [ ] Created issue JSON contains the new fields
- [ ] Creating an issue without touching model fields works (backward compatible)

### Issue Edit — model section
- [ ] Pre-populated with existing values from issue JSON
- [ ] Can change model override and save
- [ ] Can clear model override back to Auto and save
- [ ] Escalation count displays as read-only (if non-zero)
- [ ] Escalation count hidden or shows 0 when zero

### Agent Detail — tier badge
- [ ] Badge shows next to agent name when routing config exists
- [ ] Badge shows tier name + resolved model (e.g., "LEAD · Sonnet 4.6 (high)")
- [ ] No badge shown when routing config doesn't exist (graceful fallback)

### Project costs — tier breakdown
- [ ] "Cost by Model" section shows when cost entries have model field
- [ ] Shows "Model data not available" when entries lack model field
- [ ] Aggregation is correct across multiple agents' cost entries

## Regression Risk

- **Issue creation/editing** — adding new fields to the schema. Verify existing issues without these fields still load and edit correctly.
- **Agent detail page** — adding the tier badge. Verify the page still works when routing config doesn't exist.
- **Costs page** — adding tier breakdown. Verify existing cost views aren't affected when model field is missing from entries.
- **Sidebar navigation** — adding new page. Verify other nav items still work, badge counts unaffected.
