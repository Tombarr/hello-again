# Location Data Accuracy & Limitations

## TL;DR

**The location data is INFERRED, not factual.** gpt-4o-mini makes educated guesses based on names and companies without accessing LinkedIn profiles.

## How It Works

### What the Model Sees
For each connection, the model only receives:
- First Name
- Last Name
- Company Name
- Position/Title

### What the Model Does NOT Have
- ❌ Web access to look up the person
- ❌ LinkedIn profile data
- ❌ Actual user location from LinkedIn
- ❌ Email domain hints
- ❌ Previous location history

### Inference Strategy

The model makes educated guesses using:

1. **Company Headquarters** (most common)
   - "Google" → Mountain View, CA
   - "Schneider Electric" → Rueil-Malmaison, France

2. **Name Cultural/Regional Hints**
   - Name patterns suggesting nationality
   - Common regional names

3. **Position Context**
   - "Remote" in title might suggest home country
   - Regional-specific roles

## Common Inaccuracies

### 1. Company HQ Instead of User Location

**Example:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "company": "Google",
  "position": "Software Engineer",
  "location": {
    "city": "Mountain View",
    "country": "US"  // ❌ Might actually work from London
  }
}
```

**Why:** Model defaults to company HQ when no other signals exist.

### 2. Regional Office Guessing

**Example:**
```json
{
  "firstName": "Pierre",
  "lastName": "Dubois",
  "company": "Microsoft",
  "position": "Engineer",
  "location": {
    "city": "Paris",
    "country": "FR"  // ✅ Good guess based on French name
  }
}
```

**Why:** Name provides cultural hints that override company HQ.

### 3. Remote Workers

**Problem:** Someone working remotely from anywhere won't be detected correctly.

**Example:**
```json
{
  "company": "Automattic",  // Fully remote company
  "location": {
    "city": "San Francisco",  // ❌ Could be anywhere
    "country": "US"
  }
}
```

## Accuracy Estimates

Based on the data type:

| Scenario | Estimated Accuracy |
|----------|-------------------|
| Large company with single HQ | 30-40% |
| Regional name + local company | 60-70% |
| Generic name + multinational | 20-30% |
| Position mentions location | 50-60% |
| Remote workers | 10-20% |

**Overall estimated accuracy: 35-45%**

## Improvements Made

### v1 (Original)
```
"country": "United States"  // Inconsistent
"country": "USA"
"country": "US"
```

### v2 (Current - ISO Codes)
```
"country": "US"  // ✅ Consistent ISO 3166-1 alpha-2
```

**Changes:**
- ✅ Prompt clarifies "PERSON'S likely location (not company HQ)"
- ✅ Requires ISO 3166-1 alpha-2 country codes (US, GB, FR, etc.)
- ✅ System message reinforces ISO codes
- ✅ Adds "Use null if uncertain" to reduce false confidence

## How to Improve Accuracy

### Option 1: Manual Review & Correction
1. Export enriched data
2. Review flagged entries (e.g., all Google employees)
3. Manually correct known inaccuracies
4. Re-import corrected data

### Option 2: Use Email Domains
If you have email addresses in your connections:

```typescript
// Example inference improvement
if (emailAddress.endsWith('.co.uk')) {
  // Likely UK-based
} else if (emailAddress.endsWith('.de')) {
  // Likely Germany-based
}
```

### Option 3: Use LinkedIn Scraping (Risky)
**NOT RECOMMENDED** - Violates LinkedIn TOS

Could use:
- Browser automation (Puppeteer/Playwright)
- LinkedIn API (requires partnership)
- Third-party services (expensive, questionable legality)

### Option 4: Upgrade to gpt-4o with Function Calling
**More Expensive** but could improve accuracy:

1. Use function calling to request web searches
2. Model could look up "John Doe Google" + "location"
3. Extract location from search results

**Cost:** ~10x more expensive than current approach

### Option 5: Use Specialized Services

**Commercial APIs:**
- Clearbit Enrichment API (~$99/month)
- Apollo.io (~$49/month)
- Hunter.io (~$49/month)
- PDL (People Data Labs) (~$0.01 per lookup)

**Pros:**
- Real data from scraped LinkedIn profiles
- High accuracy (80-90%)

**Cons:**
- Monthly costs
- Still may violate LinkedIn TOS
- Privacy concerns

## Best Practices

### For Using Current Data

1. **Treat as Statistical Aggregate**
   - "What countries are my connections in?" ✅ Good
   - "Where exactly does John live?" ❌ Unreliable

2. **Filter by Confidence**
   - Create a "confidence score" based on:
     - Name matches country culture
     - Company has single HQ
     - Position doesn't mention "remote"

3. **Validate Samples**
   - Manually check 20-50 connections you know
   - Calculate actual accuracy rate
   - Apply correction factor to stats

4. **Use for Trends, Not Facts**
   - "~40% of connections in USA"
   - "Growing connections in Europe"
   - "San Francisco is a cluster"

### What NOT to Do

❌ Don't use for:
- Tax/legal residence determination
- Mailing physical items
- Assuming time zones
- Regulatory compliance
- Anything requiring factual accuracy

## Validation Tools

### Check Your Data Quality

```javascript
// Count country variations to spot inconsistencies
const countries = {};
data.forEach(conn => {
  const country = conn.location?.country;
  if (country) {
    countries[country] = (countries[country] || 0) + 1;
  }
});
console.log(countries);

// Should see only 2-letter codes now:
// { US: 1200, GB: 150, FR: 89, DE: 45, ... }
```

### Spot-Check Script

```javascript
// Check against your known connections
const knownLocations = {
  'Alex Rohrberg': { city: 'Paris', country: 'FR' },
  'John Smith': { city: 'London', country: 'GB' }
};

let correct = 0;
let total = 0;

data.forEach(conn => {
  const name = `${conn.firstName} ${conn.lastName}`;
  if (knownLocations[name]) {
    total++;
    const known = knownLocations[name];
    const inferred = conn.location;

    if (known.country === inferred?.country) {
      correct++;
      console.log(`✅ ${name}: ${inferred.country}`);
    } else {
      console.log(`❌ ${name}: Expected ${known.country}, got ${inferred?.country}`);
    }
  }
});

console.log(`Accuracy: ${(correct / total * 100).toFixed(1)}%`);
```

## Summary

**Current Approach:**
- ✅ Very cheap ($0.054 for 3,200 connections)
- ✅ Fast (24h batch processing)
- ✅ Privacy-friendly (no actual LinkedIn access)
- ⚠️ 35-45% accuracy
- ⚠️ Best for statistical trends, not individual facts

**For Higher Accuracy:**
- Use commercial enrichment APIs (80-90% accuracy, ~$300/month)
- Manual correction of critical connections
- Add email domain hints if available
- Treat current data as directional, not factual

## License

MIT
