# 🔍 SQL Server Connection Troubleshooting Guide

## ⚡ Quick Checklist

- [ ] Semua environment variables sudah diset di Vercel → Settings → Vars
- [ ] Server SQL Server dapat diakses dari jaringan (bukan localhost jika cloud)
- [ ] Username dan password benar
- [ ] Database name benar (case-sensitive di beberapa sistem)
- [ ] Port benar (default: 1433)
- [ ] Instance name benar (jika menggunakan named instance)

## 🛠️ Debugging Steps

### Step 1: Verify Environment Variables

```bash
npm run check-db
```

Ini akan menunjukkan:
- ✅ Semua required env vars sudah diset
- ❌ Mana yang belum diset
- 📝 Connection details yang akan digunakan

**Output example:**
```
✅ ROOT_SQL_SERVER_HOST: ***SET***
✅ ROOT_SQL_SERVER_USER: ***SET***
✅ ROOT_SQL_SERVER_PASSWORD: ***SET***
✅ ROOT_SQL_SERVER_DATABASE: ***SET***
⊘ ROOT_SQL_SERVER_PORT: not configured (will use default 1433)
```

### Step 2: Test Database Connection

```bash
npm run test-db
```

Script ini akan:
1. Attempt koneksi dengan config yang ada
2. Jalankan test query `SELECT DB_NAME()`
3. Show hasil atau error detail

**Output example berhasil:**
```
✅ Connected! Testing query...

📊 Test Query Result:
  CurrentDB: DB_DAINTY_REPORTS
  ServerTime: 2024-06-02T10:30:45.123Z

✅ Query executed successfully!
```

**Output example error:**
```
❌ Connection Failed:
Error: Login failed for user 'sa'. Reason: An error occurred during login.

💡 Suggestions:
- Check username/password
- Verify user has access to the database
- Check SQL Server authentication mode (Windows vs Mixed)
```

### Step 3: Common Error Messages & Solutions

#### ❌ "Login failed for user"
**Cause:** Username/password salah atau user tidak exist
**Solution:**
1. Verify username dan password di environment variables
2. Cek di SQL Server Management Studio bahwa user tersebut exist
3. Cek apakah SQL Server dalam mode "Mixed Authentication"

#### ❌ "Timeout expired"
**Cause:** Server tidak respond dalam 30 detik
**Solution:**
1. Cek apakah server SQL Server sedang running
2. Cek firewall rules - port 1433 harus terbuka
3. Cek network connectivity: `ping [SERVER_HOST]`
4. Jika cloud provider, cek security groups/network ACLs

#### ❌ "Server not found" / "ENOTFOUND"
**Cause:** Server host tidak ditemukan
**Solution:**
1. Verify hostname di `ROOT_SQL_SERVER_HOST`
2. Pastikan hostname benar (bukan IP lokal seperti 127.0.0.1)
3. Cek DNS resolution: `nslookup [SERVER_HOST]`

#### ❌ "Database not found" / "Invalid database"
**Cause:** Database name salah atau tidak exist
**Solution:**
1. Verify `ROOT_SQL_SERVER_DATABASE` sesuai nama database
2. Cek di SQL Server bahwa database tersebut exist
3. Cek case sensitivity (di beberapa sistem, case matters)

#### ❌ "Instance name is invalid"
**Cause:** Named instance tidak ditemukan
**Solution:**
1. Jika tidak menggunakan named instance, kosongkan `ROOT_SQL_SERVER_INSTANCE`
2. Jika menggunakan instance, pastikan nama benar: `SERVERNAME\INSTANCENAME`
3. Di SQL Server, verify instance name di Services

## 📝 Environment Variables Reference

### Required Variables
| Variable | Example | Description |
|----------|---------|-------------|
| `ROOT_SQL_SERVER_HOST` | `202.83.120.48` | SQL Server hostname/IP address |
| `ROOT_SQL_SERVER_USER` | `sa` | Login username |
| `ROOT_SQL_SERVER_PASSWORD` | `MyPassword123!` | Login password |
| `ROOT_SQL_SERVER_DATABASE` | `DB_DAINTY_REPORTS` | Database name |

### Optional Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `ROOT_SQL_SERVER_PORT` | `1433` | Connection port |
| `ROOT_SQL_SERVER_INSTANCE` | (empty) | Named instance (jika ada) |
| `ROOT_SQL_SERVER_ENCRYPT` | `false` | Enable encryption (SSL/TLS) |
| `ROOT_SQL_SERVER_TRUST_CERT` | `false` | Trust self-signed certificates |

## 🚀 Setup di Vercel

1. **Buka Project Settings**
   - Go to vercel.com → Select project
   - Settings → Environment Variables

2. **Add Variables**
   ```
   ROOT_SQL_SERVER_HOST = 202.83.120.48
   ROOT_SQL_SERVER_USER = sa
   ROOT_SQL_SERVER_PASSWORD = (your password)
   ROOT_SQL_SERVER_DATABASE = DB_DAINTY_REPORTS
   ROOT_SQL_SERVER_PORT = 1433 (optional)
   ```

3. **Deploy/Redeploy**
   - Deploy project untuk apply environment variables
   - Atau restart dev server lokal untuk test

## 🔐 Security Notes

- Jangan commit `.env` file ke Git
- Gunakan Vercel's Environment Variables untuk secrets
- Password tidak akan pernah ditampilkan di logs (ditampilkan sebagai `***SET***`)
- Untuk sensitive environments, pertimbangkan:
  - Enable encryption: `ROOT_SQL_SERVER_ENCRYPT=true`
  - Restrict network access via firewall/security groups
  - Use IP whitelisting

## 📊 Connection Pooling Details

- Connection pool dimanage di `lib/db-tedious.ts`
- Pool reused across requests (efficient)
- Default timeout: 30 seconds (connection + query)
- Max concurrent connections: unlimited (tedious default)

Jika perlu tune performance, edit:
```typescript
options: {
  connectionTimeout: 30000,  // Connection timeout (ms)
  requestTimeout: 30000,     // Query timeout (ms)
}
```

## 📞 Need Help?

1. Check logs di Vercel → Project → Deployments → Logs
2. Run `npm run check-db` locally
3. Run `npm run test-db` locally
4. Check firewall/security groups di SQL Server infrastructure
5. Verify database reachability dengan tools seperti `telnet` atau `nmap`

---

**Last Updated:** June 2, 2026
