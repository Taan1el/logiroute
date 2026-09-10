import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const { app } = createApp();

app.listen(PORT, () => {
  console.log(`[LogiRoute API] Running on http://localhost:${PORT}`);
  console.log(`[LogiRoute API] Healthcheck at http://localhost:${PORT}/api/health`);
});
