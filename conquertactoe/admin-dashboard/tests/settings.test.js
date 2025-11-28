const request = require('supertest');
const { app } = require('../backend/server');

describe('Admin Settings API', () => {
    let authToken;

    beforeAll(async () => {
        // Login as admin to get token
        const loginRes = await request(app)
            .post('/admin/auth/login')
            .send({
                email: 'admin@conquertactoe.com',
                password: 'admin123'
            });

        authToken = loginRes.body.token;
    });

    describe('GET /admin/settings', () => {
        it('should return all settings', async () => {
            const res = await request(app)
                .get('/admin/settings')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('dev_logging');
            expect(res.body).toHaveProperty('maintenance_mode');
            expect(res.body).toHaveProperty('ENABLE_DEV_LOGIN');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/admin/settings');

            expect(res.status).toBe(401);
        });
    });

    describe('PUT /admin/settings/:key', () => {
        it('should update a setting value', async () => {
            const res = await request(app)
                .put('/admin/settings/dev_logging')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ value: 'true' });

            expect(res.status).toBe(200);
            expect(res.body.value).toBe('true');
            expect(res.body.key).toBe('dev_logging');
        });

        it('should return 404 for non-existent setting', async () => {
            const res = await request(app)
                .put('/admin/settings/nonexistent_setting')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ value: 'true' });

            expect(res.status).toBe(404);
        });

        it('should return 400 when value is missing', async () => {
            const res = await request(app)
                .put('/admin/settings/dev_logging')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .put('/admin/settings/dev_logging')
                .send({ value: 'true' });

            expect(res.status).toBe(401);
        });
    });

    afterAll(async () => {
        // Reset settings to defaults
        await request(app)
            .put('/admin/settings/dev_logging')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ value: 'false' });
    });
});
