const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// GET /admin/docker/containers - List all Docker containers
router.get('/containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });

        const containerInfo = containers.map(container => ({
            id: container.Id,
            name: container.Names[0].replace('/', ''),
            image: container.Image,
            state: container.State,
            status: container.Status,
            created: container.Created,
            ports: container.Ports,
            labels: container.Labels,
            networks: Object.keys(container.NetworkSettings?.Networks || {})
        }));

        res.json(containerInfo);
    } catch (error) {
        console.error('Error fetching containers:', error);
        res.status(500).json({ error: 'Failed to fetch containers', message: error.message });
    }
});

// GET /admin/docker/logs/:containerId - Get logs for a specific container
router.get('/logs/:containerId', async (req, res) => {
    try {
        const { containerId } = req.params;
        const {
            since,      // Unix timestamp - logs since this time
            until,      // Unix timestamp - logs until this time
            stdout = 'true',     // Include stdout logs
            stderr = 'true',     // Include stderr logs
            tail = '100',        // Number of lines from the end
            timestamps = 'true', // Include timestamps
            search = ''          // Search filter
        } = req.query;

        const container = docker.getContainer(containerId);

        // Check if container exists
        try {
            await container.inspect();
        } catch (err) {
            return res.status(404).json({ error: 'Container not found' });
        }

        const logOptions = {
            stdout: stdout === 'true',
            stderr: stderr === 'true',
            timestamps: timestamps === 'true',
            tail: parseInt(tail) || 100
        };

        // Add time filters if provided
        if (since) {
            logOptions.since = parseInt(since);
        }
        if (until) {
            logOptions.until = parseInt(until);
        }

        const logStream = await container.logs(logOptions);

        // Convert buffer to string and parse
        let logs = logStream.toString('utf8');

        // Docker logs include header bytes that need to be stripped
        // Format: [stream_type (1 byte)][padding (3 bytes)][size (4 bytes)][payload]
        const lines = [];
        let offset = 0;
        const buffer = Buffer.from(logs, 'binary');

        while (offset < buffer.length) {
            // Read the header (8 bytes)
            if (offset + 8 > buffer.length) break;

            const streamType = buffer[offset]; // 1 = stdout, 2 = stderr
            const size = buffer.readUInt32BE(offset + 4);

            if (offset + 8 + size > buffer.length) break;

            const payload = buffer.slice(offset + 8, offset + 8 + size).toString('utf8');

            lines.push({
                type: streamType === 1 ? 'stdout' : streamType === 2 ? 'stderr' : 'unknown',
                message: payload.trim()
            });

            offset += 8 + size;
        }

        // Apply search filter if provided
        let filteredLines = lines;
        if (search && search.trim() !== '') {
            const searchLower = search.toLowerCase();
            filteredLines = lines.filter(line =>
                line.message.toLowerCase().includes(searchLower)
            );
        }

        // Parse log level from message content for color coding
        const enhancedLines = filteredLines.map(line => {
            const message = line.message;
            let level = 'info';

            // Detect log level from common patterns
            if (message.match(/\b(error|err|exception|failed|failure)\b/i)) {
                level = 'error';
            } else if (message.match(/\b(warn|warning)\b/i)) {
                level = 'warning';
            } else if (message.match(/\b(debug|trace)\b/i)) {
                level = 'debug';
            }

            // Extract timestamp if present
            const timestampMatch = message.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
            const timestamp = timestampMatch ? timestampMatch[1] : null;

            return {
                ...line,
                level,
                timestamp,
                rawMessage: message
            };
        });

        res.json({
            containerId,
            containerName: (await container.inspect()).Name.replace('/', ''),
            totalLines: enhancedLines.length,
            logs: enhancedLines
        });

    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs', message: error.message });
    }
});

module.exports = router;
