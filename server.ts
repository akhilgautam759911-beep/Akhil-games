import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GameDatabase } from './src/server/db';
import { MultiplayerHub } from './src/server/multiplayerHub';

async function bootstrap() {
  const app = express();
  app.use(express.json());

  const db = new GameDatabase();
  const hub = new MultiplayerHub();

  // REST APIs for profile, shop, daily rewards, missions, friends, and leaderboard
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get('/api/profile/:id', (req, res) => {
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    const profile = db.getOrCreateProfile(req.params.id, username);
    res.json({ profile });
  });

  app.post('/api/profile/:id/identity', (req, res) => {
    const profile = db.updateProfileIdentity(req.params.id, req.body ?? {});
    res.json({ profile });
  });

  app.post('/api/profile/:id/shop', (req, res) => {
    const itemId = String(req.body?.itemId ?? '');
    const result = db.purchaseOrEquip(req.params.id, itemId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/profile/:id/daily', (req, res) => {
    const result = db.claimDailyReward(req.params.id);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/profile/:id/mission', (req, res) => {
    const missionId = String(req.body?.missionId ?? '');
    const result = db.claimMission(req.params.id, missionId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/profile/:id/match-result', (req, res) => {
    const result = db.recordMatchResult(req.params.id, req.body ?? {});
    res.json(result);
  });

  app.post('/api/profile/:id/friends', (req, res) => {
    const username = String(req.body?.username ?? '');
    const result = db.addFriend(req.params.id, username);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.delete('/api/profile/:id/friends/:friendId', (req, res) => {
    const profile = db.removeFriend(req.params.id, req.params.friendId);
    res.json({ profile });
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.json({ entries: db.getLeaderboard() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    hub.registerConnection(ws);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Ludo 3D server listening on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
