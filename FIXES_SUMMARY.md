# 🔧 SQL Server Connection Fixes Summary

## Issues Found & Fixed

### ❌ Issue 1: Environment Variable Naming Mismatch
**Location:** `lib/db-tedious.ts` line ~110

**Problem:**
```typescript
// WRONG - was looking for SQL_SERVER_HOST instead of ROOT_SQL_SERVER_HOST
const server = process.env.SQL_SERVER_HOST || "localhost"
```

**Solution:**
```typescript
// FIXED - now checks both ROOT_ prefixed and non-prefixed versions
const server = this.options?.server || process.env.ROOT_SQL_SERVER_HOST || process.env.SQL_SERVER_HOST || "localhost"
```

This applies to ALL env var reads:
- `ROOT_SQL_SERVER_HOST`
- `ROOT_SQL_SERVER_USER`
- `ROOT_SQL_SERVER_PASSWORD`
- `ROOT_SQL_SERVER_DATABASE`
- `ROOT_SQL_SERVER_PORT`
- `ROOT_SQL_SERVER_INSTANCE`
- `ROOT_SQL_SERVER_ENCRYPT`
- `ROOT_SQL_SERVER_TRUST_CERT`

---

### ❌ Issue 2: Missing Credential Validation
**Location:** `lib/db-tedious.ts` connect() method

**Problem:**
Connection attempt didn't validate if required credentials were set before trying to connect.

**Solution:**
Added validation that throws clear error if username/password missing:
```typescript
if (!config.authentication.options.userName || !config.authentication.options.password) {
  const err = new Error("Username dan password wajib diisi! Cek environment variables: ROOT_SQL_SERVER_USER dan ROOT_SQL_SERVER_PASSWORD")
  console.error("[v0-tedious] Credential validation failed:", err.message)
  throw err
}
```

---

### ❌ Issue 3: Insufficient Error Logging
**Location:** `lib/db-tedious.ts` connect() method

**Problem:**
Error messages were vague and didn't help identify the root cause.

**Solution:**
Added detailed error logging with context:
- Connection attempt details (server, database, port, etc.)
- Error codes and numbers
- Actionable hints based on error type:
  - `ELOGIN` → Login failed
  - `ETIMEOUT` → Network timeout
  - `ENOTFOUND` → Server not found

Example of new detailed log:
```
❌ FAILED: Login failed for user 'sa'
ℹ️ Login failed - cek username/password di environment variables
```

---

## New Debugging Tools Created

### 1. `npm run check-db`
Checks all environment variables configuration:
```bash
✅ ROOT_SQL_SERVER_HOST: ***SET***
✅ ROOT_SQL_SERVER_USER: ***SET***
❌ ROOT_SQL_SERVER_PASSWORD: NOT SET
```

**Location:** `scripts/check-db-config.js`

### 2. `npm run test-db`
Test actual connection to SQL Server:
```bash
🧪 Testing SQL Server Connection...
✅ Connected! Testing query...
📊 Test Query Result:
  CurrentDB: DB_DAINTY_REPORTS
  ServerTime: 2024-06-02T10:30:45.123Z
```

**Location:** `scripts/test-db-connection.js`

### 3. Troubleshooting Guide
Complete guide untuk debugging connection issues:
**Location:** `docs/SQL_SERVER_TROUBLESHOOTING.md`

---

## How to Verify Fixes

### 1. Check Environment Variables (Vercel)
Go to: **Settings → Vars** dalam project Anda
```
✅ ROOT_SQL_SERVER_HOST = 202.83.120.48 (or your server)
✅ ROOT_SQL_SERVER_USER = sa (or your user)
✅ ROOT_SQL_SERVER_PASSWORD = (your password)
✅ ROOT_SQL_SERVER_DATABASE = DB_DAINTY_REPORTS (or your db)
```

### 2. Test Locally (Dev Environment)
```bash
# Check configuration
npm run check-db

# Test connection
npm run test-db
```

### 3. Check Application Logs
Logs sekarang lebih detail dan akan menunjukkan:
- Exact configuration being used
- Connection status dan error details
- Actionable hints untuk troubleshooting

---

## What Changed in Code

### Files Modified:
1. **`lib/db-tedious.ts`** - Fixed env var reading + improved error handling
2. **`package.json`** - Added test scripts

### Files Created:
1. **`scripts/check-db-config.js`** - Validate environment variables
2. **`scripts/test-db-connection.js`** - Test database connection
3. **`docs/SQL_SERVER_TROUBLESHOOTING.md`** - Complete troubleshooting guide

---

## Next Steps

1. Ensure all environment variables are set in Vercel → Settings → Vars
2. Run `npm run check-db` locally to verify config
3. Run `npm run test-db` locally to verify connection
4. Check logs when deploying for detailed error messages
5. Refer to troubleshooting guide if issues persist

---

**If connection still fails after these fixes**, check:
- [ ] Network connectivity to SQL Server
- [ ] Firewall rules allow port 1433
- [ ] SQL Server is running and accessible
- [ ] Credentials are correct (test in SQL Server Management Studio)
- [ ] Database exists and user has access
