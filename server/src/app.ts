import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from './db/database.js';
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { createApiRouter } from './routes/api.routes.js';

export interface AppContext {
  app: Express;
  db: DatabaseSync;
}

/** Finds the built client: CLIENT_DIST, then next to the sources, then next to the compiled output. */
function findClientDist(): string | null {
  const here = import.meta.dirname;
  const candidates = [
    process.env.CLIENT_DIST ? path.resolve(process.env.CLIENT_DIST) : '',
    path.resolve(here, '../../client/dist'),
    path.resolve(here, '../../../../client/dist'),
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? null;
}

export function createApp(dbPath?: string, shouldSeed = true): AppContext {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = createDatabase(dbPath);
  initializeSchema(db);
  if (shouldSeed) {
    seedDatabase(db);
  }

  app.use('/api', createApiRouter(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  const clientDist = findClientDist();
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status === 400 || err.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.error('Unhandled server error:', err);
    res.status(status).json({ success: false, error: status === 400 ? 'Invalid JSON body' : 'Internal Server Error' });
  });

  return { app, db };
}
