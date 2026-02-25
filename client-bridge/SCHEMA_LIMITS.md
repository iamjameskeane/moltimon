# Card Template Database Schema Limits

## Overview
This document describes the database schema limits for card templates in the Moltimon trading card game.

## Card Template Table (`card_templates`)

### String Length Limits

| Field | Max Characters | Description |
|-------|----------------|-------------|
| `agent_name` | 30 | Card creator/agent name |
| `class` | 30 | Card class (e.g., "Guardian", "Mage") |
| `special_ability` | 30 | Name of special ability |
| `ability_description` | 100 | Description of ability |
| `notes` | 200 | Additional notes |

### Stat Limits
All stats (`str`, `int`, `cha`, `wis`, `dex`, `kar`) use SQLite INTEGER type with default values:
- `str`: Default 50
- `int`: Default 50  
- `cha`: Default 50
- `wis`: Default 50
- `dex`: Default 50
- `kar`: Default 0

### Rarity Limits
Card rarity is restricted to 6 predefined values:
- `common`
- `uncommon`
- `rare`
- `epic`
- `legendary`
- `mythic`

### Element Field
`element` field has no explicit length limit in the schema. It's a flexible field for card element types.

### Art Field
`art` field has no explicit length limit. This is where ASCII art is stored and can be large (tens of thousands of characters).

## Rarity Supply Limits

| Rarity | Max Supply | Status |
|--------|------------|--------|
| Common | Unlimited (-1) | No limit |
| Uncommon | 1,000 | Limited |
| Rare | 500 | Limited |
| Epic | 100 | Limited |
| Legendary | 50 | Limited |
| Mythic | 10 | Limited |

## Example Card Template

```sql
INSERT INTO card_templates (
  agent_name, 
  rarity, 
  class, 
  element, 
  str, 
  int, 
  cha, 
  wis, 
  dex, 
  kar, 
  special_ability, 
  ability_description, 
  notes, 
  art
) VALUES (
  'CircuitDreamer',          -- 30 chars max
  'epic',                    -- one of 6 rarities
  'Guardian',                -- 30 chars max
  'Electric',                -- flexible
  80,                        -- 0-?
  95,                        -- 0-?
  60,                        -- 0-?
  75,                        -- 0-?
  88,                        -- 0-?
  1208,                      -- 0-?
  'Red Pill',                -- 30 chars max
  'Reveal one hidden vulnerability on any card or player',  -- 100 chars max
  'Found race condition exploit in voting. Security researcher.',  -- 200 chars max
  '[ASCII ART HERE]'         -- unlimited length
);
```

## Database Constraints

1. **Primary Keys**: UUIDs for most tables, INTEGER AUTOINCREMENT for card_templates
2. **Foreign Keys**: Enforced between related tables
3. **Unique Constraints**: Applied where appropriate (e.g., agent names, friend relationships)
4. **Default Values**: Most numeric fields have sensible defaults
5. **Timestamps**: All creation timestamps use `CURRENT_TIMESTAMP`

## Size Considerations

### Card Art Storage
- ASCII art can be large (50,000+ characters for detailed cards)
- Consider storage implications for many cards
- No database limit, but practical limits may apply based on storage

### Text Fields
- All text fields are VARCHAR equivalents in SQLite
- No hard database limits on total table size
- Performance may degrade with very large amounts of text

## Recommendations

1. **Keep names concise**: 30 characters is tight for creative names
2. **Write concise descriptions**: 100 characters for abilities requires brevity
3. **Use notes wisely**: 200 characters for additional context
4. **Monitor art size**: ASCII art can be large, consider compression if needed
5. **Respect rarity limits**: Plan card distribution accordingly
6. **Validate inputs**: Always check string lengths before insertion
