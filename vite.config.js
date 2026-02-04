import { defineConfig } from 'vite';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Vite plugin that adds API endpoints for snapshot management.
 * POST /__snapshots/save - saves a snapshot to an exploration's snapshots.json
 * DELETE /__snapshots/delete - removes a snapshot from an exploration's snapshots.json
 */
function snapshotApiPlugin() {
  return {
    name: 'snapshot-api',
    configureServer(server) {
      server.middlewares.use('/__snapshots/save', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { exploration, state } = JSON.parse(body);
            const snapshotsPath = join(process.cwd(), exploration, 'snapshots.json');
            
            // Load existing snapshots or start fresh
            let snapshots = [];
            if (existsSync(snapshotsPath)) {
              snapshots = JSON.parse(readFileSync(snapshotsPath, 'utf-8'));
            }
            
            // Add new snapshot
            const snapshotNumber = snapshots.length + 1;
            snapshots.push({
              name: `Snapshot ${snapshotNumber}`,
              state,
              createdAt: new Date().toISOString()
            });
            
            writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, name: `Snapshot ${snapshotNumber}` }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      server.middlewares.use('/__snapshots/delete', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { exploration, index } = JSON.parse(body);
            const snapshotsPath = join(process.cwd(), exploration, 'snapshots.json');
            
            if (!existsSync(snapshotsPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'No snapshots file found' }));
              return;
            }
            
            let snapshots = JSON.parse(readFileSync(snapshotsPath, 'utf-8'));
            
            if (index < 0 || index >= snapshots.length) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid snapshot index' }));
              return;
            }
            
            // Remove the snapshot
            snapshots.splice(index, 1);
            
            // Renumber remaining snapshots
            snapshots = snapshots.map((s, i) => ({
              ...s,
              name: `Snapshot ${i + 1}`
            }));
            
            writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [snapshotApiPlugin()]
});
