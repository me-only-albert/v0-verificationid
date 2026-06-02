#!/usr/bin/env node
/**
 * Script untuk test SQL Server connection secara langsung
 * Run: node scripts/test-db-connection.js
 */

const { Connection, Request, TYPES } = require('tedious');

async function testConnection() {
  console.log('🧪 Testing SQL Server Connection...\n');

  const config = {
    server: process.env.ROOT_SQL_SERVER_HOST || 'localhost',
    authentication: {
      type: 'default',
      options: {
        userName: process.env.ROOT_SQL_SERVER_USER || 'sa',
        password: process.env.ROOT_SQL_SERVER_PASSWORD || '',
      },
    },
    options: {
      database: process.env.ROOT_SQL_SERVER_DATABASE || 'master',
      encrypt: process.env.ROOT_SQL_SERVER_ENCRYPT === 'true',
      trustServerCertificate: process.env.ROOT_SQL_SERVER_TRUST_CERT === 'true',
      connectionTimeout: 30000,
      requestTimeout: 30000,
      port: parseInt(process.env.ROOT_SQL_SERVER_PORT || '1433', 10),
      instanceName: process.env.ROOT_SQL_SERVER_INSTANCE || undefined,
    },
  };

  // Remove undefined values
  if (!config.options.instanceName) {
    delete config.options.instanceName;
  }

  console.log('📋 Configuration:');
  console.log(`  Server: ${config.server}`);
  console.log(`  Port: ${config.options.port}`);
  console.log(`  Instance: ${config.options.instanceName || 'none'}`);
  console.log(`  Database: ${config.options.database}`);
  console.log(`  User: ${config.authentication.options.userName}`);
  console.log(`  Encrypt: ${config.options.encrypt}`);
  console.log(`  TrustCert: ${config.options.trustServerCertificate}\n`);

  return new Promise((resolve) => {
    const connection = new Connection(config);

    connection.on('connect', (err) => {
      if (err) {
        console.error('❌ Connection Failed:\n', err);
        resolve(false);
        return;
      }

      console.log('✅ Connected! Testing query...\n');

      // Test query
      const request = new Request('SELECT DB_NAME() AS CurrentDB, GETDATE() AS ServerTime', (err) => {
        if (err) {
          console.error('❌ Query Failed:\n', err);
          connection.close();
          resolve(false);
          return;
        }

        console.log('✅ Query executed successfully!');
        connection.close();
        resolve(true);
      });

      request.on('row', (columns) => {
        console.log('📊 Test Query Result:');
        columns.forEach((col) => {
          console.log(`  ${col.metadata.colName}: ${col.value}`);
        });
        console.log('');
      });

      connection.execSql(request);
    });

    connection.on('error', (err) => {
      console.error('❌ Connection Error:\n', err);
      resolve(false);
    });

    connection.on('end', () => {
      console.log('Connection ended');
    });

    console.log('🔌 Attempting to connect...\n');
    connection.connect();

    // Timeout after 60 seconds
    setTimeout(() => {
      console.error('❌ Connection timeout (60s)');
      connection.close();
      resolve(false);
    }, 60000);
  });
}

testConnection().then((success) => {
  process.exit(success ? 0 : 1);
});
