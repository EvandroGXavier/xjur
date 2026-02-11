
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Adjust path if necessary
import { PrismaService } from '@drx/database';

describe('Auth System (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let testUserEmail = `test_${Date.now()}@example.com`; // Unique email per run

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // Enable DTO validation
    
    // Get Prisma Service to clean up after tests or seed
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await app.init();
  });

  afterAll(async () => {
    // Cleanup: Delete the test user and tenant created
    if (prisma) {
        // Find user first to get tenant ID
        const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
        if (user) {
            await prisma.user.deleteMany({ where: { tenantId: user.tenantId } });
            await prisma.tenant.delete({ where: { id: user.tenantId } });
        }
    }
    await app.close();
  });

  it('/saas/register (POST) - Should create a new tenant and admin user', async () => {
    const payload = {
        tenantName: 'Test Corp',
        document: `123456780001${Math.floor(Math.random() * 90) + 10}`, // Random document to avoid conflict
        adminName: 'Test Admin',
        email: testUserEmail,
        password: 'password123',
        mobile: '11999999999'
    };

    const response = await request(app.getHttpServer())
      .post('/saas/register')
      .send(payload)
      .expect(201); // Created

    expect(response.body).toHaveProperty('tenantId');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUserEmail);
  });

  it('/auth/login (POST) - Should return a JWT token for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
          email: testUserEmail,
          password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    authToken = response.body.access_token; // Save for protected route tests
  });

  it('/auth/login (POST) - Should fail with invalid password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
          email: testUserEmail,
          password: 'wrongpassword'
      })
      .expect(401); // Unauthorized
  });

  it('/auth/login (POST) - Should fail validation with invalid email format', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
          email: 'not-an-email',
          password: 'password123'
      })
      .expect(400); // Bad Request (Validation Pipe)
      
    // Expect error message about email
    // The exact message depends on class-validator config, but usually contains "email"
  });

  it('/auth/forgot-password (POST) - Should accept valid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUserEmail })
        .expect(200);
  });
  
  it('/auth/forgot-password (POST) - Should gracefully handle non-existent email', async () => {
      // Security: We respond 200/OK even if email doesn't exist, to prevent enumeration
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);
  });

  // Protected Route Test Example (Need an actual protected route to test)
  // it('/saas/tenants (GET) - Should require authentication', async () => {
  //   await request(app.getHttpServer())
  //     .get('/saas/tenants')
  //     .expect(401);
  // });
  
  // it('/saas/tenants (GET) - Should work with valid token', async () => {
  //   await request(app.getHttpServer())
  //     .get('/saas/tenants')
  //     .set('Authorization', `Bearer ${authToken}`)
  //     .expect(200);
  // });

  it('/auth/reset-password (POST) - Should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
            token: 'invalid-token',
            password: 'newpassword123'
        })
        .expect(401);
  });

  it('/auth/reset-password (POST) - Should reset password with valid token', async () => {
      // 1. Get user ID
      const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
      const userId = user.id;

      // 2. Generate valid recovery token using the SAME secret as AuthService
      const payload = { sub: userId, type: 'recovery' };
      const token = jwtService.sign(payload, { expiresIn: '1h', secret: 'RECOVERY_SECRET_CHANGE_ME' });

      // 3. Reset password
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
            token: token,
            password: 'newpassword123'
        })
        .expect(200);

      // 4. Verify old password fails
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
            email: testUserEmail,
            password: 'password123'
        })
        .expect(401);

      // 5. Verify new password works
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
            email: testUserEmail,
            password: 'newpassword123'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('access_token');
  });

});
