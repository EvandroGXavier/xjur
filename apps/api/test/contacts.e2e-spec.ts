import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { PrismaService } from '@drx/database';
import { AppModule } from '../src/app.module';

describe('Contacts Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  const testUserEmail = `contacts_${Date.now()}@example.com`;

  let contactId: string;
  let contact2Id: string;
  let addressId: string;
  let additionalContactId: string;
  let relationTypeId: string;
  let relationId: string;
  let assetTypeId: string;
  let assetId: string;
  let contractId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get(PrismaService);
    await app.init();

    await request(app.getHttpServer())
      .post('/saas/register')
      .send({
        tenantName: 'Contacts Test Corp',
        document: `987654320001${Math.floor(Math.random() * 90) + 10}`,
        adminName: 'Contacts Admin',
        email: testUserEmail,
        password: 'password123',
        mobile: '11999999999',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUserEmail, password: 'password123' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(login.body).toHaveProperty('access_token');
    authToken = login.body.access_token;
  });

  afterAll(async () => {
    if (prisma) {
      const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
      if (user) {
        await prisma.user.deleteMany({ where: { tenantId: user.tenantId } });
        await prisma.tenant.delete({ where: { id: user.tenantId } });
      }
    }
    await app.close();
  });

  it('create contact (Aba: Dados)', async () => {
    const res = await request(app.getHttpServer())
      .post('/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Contato E2E 01',
        personType: 'PF',
        whatsapp: '11988887777',
        email: 'contato01@example.com',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    contactId = res.body.id;
  });

  it('visualizar (lista e detalhe)', async () => {
    const list = await request(app.getHttpServer())
      .get('/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((c: any) => c?.id === contactId)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/contacts/${contactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(detail.body).toHaveProperty('id', contactId);
  });

  it('alterar contato (Aba: Dados)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/contacts/${contactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Contato E2E 01 (Atualizado)' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(res.body).toHaveProperty('id', contactId);
    expect(res.body).toHaveProperty('name', 'Contato E2E 01 (Atualizado)');
  });

  it('enderecos: incluir, alterar, excluir (Aba: Enderecos)', async () => {
    const created = await request(app.getHttpServer())
      .post(`/contacts/${contactId}/addresses`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'RESIDENCIAL',
        zipCode: '01001000',
        street: 'Praca da Se',
        number: '100',
        district: 'Se',
        city: 'Sao Paulo',
        state: 'SP',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    expect(created.body).toHaveProperty('id');
    addressId = created.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/contacts/${contactId}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ city: 'Sao Paulo (Centro)' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(updated.body).toHaveProperty('id', addressId);
    expect(updated.body).toHaveProperty('city', 'Sao Paulo (Centro)');

    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}/addresses/${addressId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);
  });

  it('contatos adicionais: incluir, alterar, excluir (Aba: Contatos Adicionais)', async () => {
    const created = await request(app.getHttpServer())
      .post(`/contacts/${contactId}/additional-contacts`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'EMAIL', value: 'alt@example.com', nomeContatoAdicional: 'Financeiro' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    expect(created.body).toHaveProperty('id');
    additionalContactId = created.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/contacts/${contactId}/additional-contacts/${additionalContactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ value: 'alt2@example.com' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(updated.body).toHaveProperty('id', additionalContactId);
    expect(updated.body).toHaveProperty('value', 'alt2@example.com');

    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}/additional-contacts/${additionalContactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);
  });

  it('relacoes: tipos + incluir e excluir relacao (Aba: Relacoes)', async () => {
    const type = await request(app.getHttpServer())
      .post('/contacts/relations/types')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Socio ${Date.now()}`, reverseName: 'Socio', isBilateral: true })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    expect(type.body).toHaveProperty('id');
    relationTypeId = type.body.id;

    const contact2 = await request(app.getHttpServer())
      .post('/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Contato E2E 02', personType: 'PF', whatsapp: '11977776666' })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);
    contact2Id = contact2.body.id;

    const created = await request(app.getHttpServer())
      .post(`/contacts/${contactId}/relations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ toContactId: contact2Id, relationTypeId })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    expect(created.body).toHaveProperty('id');
    relationId = created.body.id;

    const list = await request(app.getHttpServer())
      .get(`/contacts/${contactId}/relations`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((r: any) => r?.id === relationId)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}/relations/${relationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);
  });

  it('bens: tipos + incluir, alterar e excluir bem (Aba: Bens)', async () => {
    const type = await request(app.getHttpServer())
      .post('/contacts/assets/types')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Imovel ${Date.now()}` })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    assetTypeId = type.body.id;

    const created = await request(app.getHttpServer())
      .post(`/contacts/${contactId}/assets`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        assetTypeId,
        description: 'Apartamento',
        acquisitionDate: '2025-01-15',
        value: 123456.78,
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    assetId = created.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/contacts/${contactId}/assets/${assetId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        assetTypeId,
        description: 'Apartamento (Atualizado)',
        acquisitionDate: '2025-01-15',
        value: 123456.78,
        notes: 'Atualizado no teste',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(updated.body).toHaveProperty('id', assetId);
    expect(updated.body).toHaveProperty('description', 'Apartamento (Atualizado)');

    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}/assets/${assetId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);
  });

  it('contratos: incluir, alterar, excluir (Aba: Contratos)', async () => {
    const created = await request(app.getHttpServer())
      .post(`/contacts/${contactId}/contracts`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'SERVICE',
        description: 'Contrato Mensal',
        dueDay: 10,
        firstDueDate: '2025-02-10',
        billingFrequency: 'MONTHLY',
        transactionKind: 'INCOME',
        counterpartyRole: 'CONTRACTOR',
        counterpartyName: 'Cliente X',
        status: 'ACTIVE',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(201);

    contractId = created.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/contacts/${contactId}/contracts/${contractId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'SERVICE',
        description: 'Contrato Mensal (Atualizado)',
        dueDay: 10,
        firstDueDate: '2025-02-10',
        billingFrequency: 'MONTHLY',
        transactionKind: 'INCOME',
        counterpartyRole: 'CONTRACTOR',
        counterpartyName: 'Cliente X',
        status: 'ACTIVE',
        notes: 'Atualizado no teste',
      })
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    expect(updated.body).toHaveProperty('id', contractId);

    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}/contracts/${contractId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);
  });

  it('excluir contato (Aba: Dados)', async () => {
    await request(app.getHttpServer())
      .delete(`/contacts/${contactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/contacts/${contactId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .timeout({ response: 30000, deadline: 60000 })
      .expect(404);

    if (contact2Id) {
      await request(app.getHttpServer())
        .delete(`/contacts/${contact2Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .timeout({ response: 30000, deadline: 60000 })
        .expect(200);
    }
  });
});
