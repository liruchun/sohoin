import EmbeddedPostgres from 'embedded-postgres';
import {existsSync} from 'node:fs';
import path from 'node:path';
const connection=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(connection.hostname))throw new Error('Local database launcher requires a loopback address');
const directory=path.resolve('.local/postgres17');
const postgres=new EmbeddedPostgres({databaseDir:directory,user:decodeURIComponent(connection.username),password:decodeURIComponent(connection.password),port:Number(connection.port),persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
if(!existsSync(path.join(directory,'PG_VERSION')))await postgres.initialise();
await postgres.start();
const client=postgres.getPgClient('postgres','127.0.0.1');await client.connect();
const name=connection.pathname.slice(1);if(!/^[a-z][a-z0-9_]*$/.test(name))throw new Error('Invalid local database name');
if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await client.query('CREATE DATABASE "'+name+'"');
await client.end();
console.log('Local PostgreSQL ready on 127.0.0.1:'+connection.port+' (persistent project data).');
let stopping=false;async function stop(){if(stopping)return;stopping=true;try{await postgres.stop();}finally{process.exit(0);}}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('message',message=>{if(message==='stop')void stop();});setInterval(()=>{},60000);
