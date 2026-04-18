import fs from 'node:fs';
import path from 'node:path';
import { JSONFilePreset } from 'lowdb/node';

const dataDirPath = path.join(process.cwd(), 'data');
const dbFilePath = path.join(dataDirPath, 'db.json');

fs.mkdirSync(dataDirPath, { recursive: true });

const defaultData = {
  users: [],
  refreshTokens: [],
  loginAttempts: [],
};

export const db = await JSONFilePreset(dbFilePath, defaultData);
