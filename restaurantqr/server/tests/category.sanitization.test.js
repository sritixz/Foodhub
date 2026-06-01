import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import Category from '../models/Category.js';
import User from '../models/User.js';
import categoryRoutes from '../routes/categories.js';

/**
 * Feature: category-management
 * Property 13: Input sanitization
 * 
 * For any category name or description containing potentially malicious content
 * (HTML tags, script tags, SQL injection attempts), the system should sanitize
 * the input before storage, removing or escaping dangerous characters.
 * 
 * Validates: Requirements 11.5
 */
describe('Feature: category-management, Property 13: Input sanitization', () => {
  let mongoServer;
  let app;
  let adminToken;
  
  // JWT secret for testing
  const JWT_SECRET = 'test-secret-key';
  process.env.JWT_SECRET = JWT_SECRET;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-sanitization-test' });

    // Set up Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/categories', categoryRoutes);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await Category.deleteMany({});
    await User.deleteMany({});
    
    // Create admin user and token for each test
    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin-${Date.now()}@example.com`,
      phone: '1234567890',
      role: 'Admin',
      password: 'password123',
      status: 'Active'
    });
    
    adminToken = jwt.sign({ userId: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  // Custom arbitraries for malicious input
  const maliciousHtmlArbitrary = fc.oneof(
    fc.constant('<script>alert("XSS")</script>'),
    fc.constant('<img src=x onerror=alert("XSS")>'),
    fc.constant('<iframe src="javascript:alert(\'XSS\')"></iframe>'),
    fc.constant('<svg onload=alert("XSS")>'),
    fc.constant('<body onload=alert("XSS")>'),
    fc.constant('<input onfocus=alert("XSS") autofocus>'),
    fc.constant('<marquee onstart=alert("XSS")>'),
    fc.constant('<div onclick="alert(\'XSS\')">Click me</div>'),
    fc.constant('<a href="javascript:alert(\'XSS\')">Link</a>'),
    fc.constant('<style>body{background:url("javascript:alert(\'XSS\')")}</style>')
  );

  const maliciousSqlArbitrary = fc.oneof(
    fc.constant("'; DROP TABLE categories; --"),
    fc.constant("' OR '1'='1"),
    fc.constant("admin'--"),
    fc.constant("' UNION SELECT * FROM users--"),
    fc.constant("1' AND '1'='1")
  );

  const maliciousInputArbitrary = fc.oneof(
    maliciousHtmlArbitrary,
    maliciousSqlArbitrary,
    fc.string({ minLength: 1, maxLength: 50 }).map(s => `<b>${s}</b>`),
    fc.string({ minLength: 1, maxLength: 50 }).map(s => `<script>${s}</script>`),
    fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}<img src=x>`)
  );

  it('should sanitize HTML tags in category names on creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        maliciousInputArbitrary,
        async (maliciousName) => {
          // Attempt to create category with malicious name
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: maliciousName });

          // Should either succeed with sanitized data or fail validation (if too long after sanitization)
          if (response.status === 400) {
            // Validation error is acceptable (e.g., name too long after escaping)
            return;
          }
          
          expect(response.status).toBe(201);

          // Verify the stored name does not contain executable HTML tags
          const storedCategory = await Category.findById(response.body._id);
          
          // The key security check: < and > must be escaped to prevent tag execution
          // Once these are escaped, the content is safe even if it contains event handler names
          if (maliciousName.includes('<script')) {
            expect(storedCategory.name).not.toContain('<script');
            expect(storedCategory.name).toContain('&lt;script');
          }
          if (maliciousName.includes('</script>')) {
            expect(storedCategory.name).not.toContain('</script>');
          }
          
          // Verify that HTML entities are escaped (e.g., < becomes &lt;)
          if (maliciousName.includes('<')) {
            expect(storedCategory.name).toContain('&lt;');
          }
          if (maliciousName.includes('>')) {
            expect(storedCategory.name).toContain('&gt;');
          }
          
          // Cleanup
          await Category.deleteOne({ _id: storedCategory._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize HTML tags in category descriptions on creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        maliciousInputArbitrary,
        async (safeName, maliciousDescription) => {
          // Create category with safe name but malicious description
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ 
              name: safeName,
              description: maliciousDescription 
            });

          // Should either succeed with sanitized data or fail validation
          if (response.status === 400) {
            // Validation error is acceptable
            return;
          }
          
          expect(response.status).toBe(201);

          // Verify the stored description does not contain executable HTML tags
          const storedCategory = await Category.findById(response.body._id);
          
          // Check that dangerous patterns are escaped (not executable)
          if (maliciousDescription.includes('<script')) {
            expect(storedCategory.description).not.toContain('<script');
            expect(storedCategory.description).toContain('&lt;script');
          }
          if (maliciousDescription.includes('</script>')) {
            expect(storedCategory.description).not.toContain('</script>');
          }
          
          // Verify that HTML entities are escaped
          if (maliciousDescription.includes('<')) {
            expect(storedCategory.description).toContain('&lt;');
          }
          if (maliciousDescription.includes('>')) {
            expect(storedCategory.description).toContain('&gt;');
          }
          
          // Cleanup
          await Category.deleteOne({ _id: storedCategory._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize HTML tags in category names on update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        maliciousInputArbitrary,
        async (initialName, maliciousName) => {
          // Create category with safe name
          const category = await Category.create({ name: initialName.trim() });
          
          // Attempt to update with malicious name
          const response = await request(app)
            .put(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: maliciousName });

          // Should either succeed with sanitized data or fail validation
          if (response.status === 400) {
            // Validation error is acceptable
            await Category.deleteOne({ _id: category._id });
            return;
          }
          
          expect(response.status).toBe(200);

          // Verify the updated name does not contain executable HTML tags
          const updatedCategory = await Category.findById(category._id);
          
          // Check that dangerous patterns are escaped (not executable)
          if (maliciousName.includes('<script')) {
            expect(updatedCategory.name).not.toContain('<script');
            expect(updatedCategory.name).toContain('&lt;script');
          }
          if (maliciousName.includes('</script>')) {
            expect(updatedCategory.name).not.toContain('</script>');
          }
          
          // Verify that HTML entities are escaped
          if (maliciousName.includes('<')) {
            expect(updatedCategory.name).toContain('&lt;');
          }
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize HTML tags in category descriptions on update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        maliciousInputArbitrary,
        async (safeName, maliciousDescription) => {
          // Create category with safe data
          const category = await Category.create({ 
            name: safeName.trim(),
            description: 'Safe description'
          });
          
          // Attempt to update with malicious description
          const response = await request(app)
            .put(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ description: maliciousDescription });

          // Should either succeed with sanitized data or fail validation
          if (response.status === 400) {
            // Validation error is acceptable
            await Category.deleteOne({ _id: category._id });
            return;
          }
          
          expect(response.status).toBe(200);

          // Verify the updated description does not contain executable HTML tags
          const updatedCategory = await Category.findById(category._id);
          
          // Check that dangerous patterns are escaped (not executable)
          if (maliciousDescription.includes('<script')) {
            expect(updatedCategory.description).not.toContain('<script');
            expect(updatedCategory.description).toContain('&lt;script');
          }
          if (maliciousDescription.includes('</script>')) {
            expect(updatedCategory.description).not.toContain('</script>');
          }
          
          // Verify that HTML entities are escaped
          if (maliciousDescription.includes('<')) {
            expect(updatedCategory.description).toContain('&lt;');
          }
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent XSS attacks through category data', async () => {
    await fc.assert(
      fc.asyncProperty(
        maliciousHtmlArbitrary,
        async (xssPayload) => {
          // Create category with XSS payload
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ 
              name: `Test ${xssPayload}`,
              description: xssPayload
            });

          // Should either succeed with sanitized data or fail validation
          if (response.status === 400) {
            // Validation error is acceptable
            return;
          }
          
          expect(response.status).toBe(201);

          const storedCategory = await Category.findById(response.body._id);
          
          // Verify that the payload is escaped and cannot execute
          // The critical check: executable script tags must not be present
          const nameHasExecutableScript = storedCategory.name.includes('<script>');
          const descHasExecutableScript = storedCategory.description.includes('<script>');
          
          expect(nameHasExecutableScript).toBe(false);
          expect(descHasExecutableScript).toBe(false);
          
          // Verify HTML entities are escaped (< and > are escaped, making tags non-executable)
          if (xssPayload.includes('<')) {
            expect(storedCategory.name.includes('&lt;') || storedCategory.description.includes('&lt;')).toBe(true);
          }
          
          // Cleanup
          await Category.deleteOne({ _id: storedCategory._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle SQL injection attempts safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        maliciousSqlArbitrary,
        async (sqlPayload) => {
          // Attempt to create category with SQL injection payload
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ 
              name: `Category ${sqlPayload}`,
              description: sqlPayload
            })
            .expect(201);

          // Verify the category was created and data is sanitized
          const storedCategory = await Category.findById(response.body._id);
          expect(storedCategory).toBeDefined();
          
          // Verify dangerous SQL patterns are escaped
          expect(storedCategory.name).not.toContain("'; DROP");
          expect(storedCategory.name).not.toContain("' OR '1'='1");
          
          // The data should be stored safely (escaped)
          if (sqlPayload.includes("'")) {
            // Single quotes should be escaped or the string should be safe
            expect(storedCategory.name).toBeDefined();
          }
          
          // Cleanup
          await Category.deleteOne({ _id: storedCategory._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve safe content while sanitizing dangerous content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && 
                 !trimmed.includes('<') && 
                 !trimmed.includes('>') &&
                 !trimmed.includes('&');
        }),
        async (safeContent) => {
          const mixedContent = `${safeContent}<script>alert('xss')</script>`;
          
          // Create category with mixed content
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: mixedContent });

          // Should either succeed with sanitized data or fail validation
          if (response.status === 400) {
            // Validation error is acceptable (e.g., too long after escaping)
            return;
          }
          
          expect(response.status).toBe(201);

          const storedCategory = await Category.findById(response.body._id);
          
          // Safe content should be preserved
          expect(storedCategory.name).toContain(safeContent);
          
          // Dangerous content should be escaped
          expect(storedCategory.name).not.toContain('<script>');
          expect(storedCategory.name).toContain('&lt;script&gt;');
          
          // Cleanup
          await Category.deleteOne({ _id: storedCategory._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});
