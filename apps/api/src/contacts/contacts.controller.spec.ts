import { UnauthorizedException } from '@nestjs/common';
import { ContactsController } from './contacts.controller';

describe('ContactsController', () => {
  const createController = () => {
    const contactsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getContactInsights: jest.fn(),
      addAddress: jest.fn(),
      updateAddress: jest.fn(),
      removeAddress: jest.fn(),
      addAdditionalContact: jest.fn(),
      updateAdditionalContact: jest.fn(),
      removeAdditionalContact: jest.fn(),
      lookupContactExact: jest.fn(),
      cleanupContacts: jest.fn(),
      bulkAction: jest.fn(),
      getRelationTypes: jest.fn(),
      createRelationType: jest.fn(),
      getContactRelations: jest.fn(),
      createContactRelation: jest.fn(),
      removeContactRelation: jest.fn(),
      getAssetTypes: jest.fn(),
      createAssetType: jest.fn(),
      getContactAssets: jest.fn(),
      createContactAsset: jest.fn(),
      updateContactAsset: jest.fn(),
      removeContactAsset: jest.fn(),
      getContactContracts: jest.fn(),
      createContactContract: jest.fn(),
      updateContactContract: jest.fn(),
      removeContactContract: jest.fn(),
      getContactFinancialRecords: jest.fn(),
      getAttachmentForContact: jest.fn(),
      uploadAttachments: jest.fn(),
      deleteAttachment: jest.fn(),
    };
    const enrichmentService = {
      consultCNPJ: jest.fn(),
      consultCEP: jest.fn(),
    };
    const contactsImportService = {
      parseFile: jest.fn(),
      executeImport: jest.fn(),
    };

    return {
      contactsService,
      enrichmentService,
      contactsImportService,
      controller: new ContactsController(
        contactsService as never,
        enrichmentService as never,
        contactsImportService as never,
      ),
    };
  };

  it('encaminha o tenant corretamente para consultar insights', () => {
    const { controller, contactsService } = createController();

    controller.getInsights('contact-1', { tenantId: 'tenant-1' } as never);

    expect(contactsService.getContactInsights).toHaveBeenCalledWith('contact-1', 'tenant-1');
  });

  it('encaminha atualizacao de endereco com tenant e ids corretos', () => {
    const { controller, contactsService } = createController();
    const body = { city: 'Belo Horizonte' };

    controller.updateAddress('contact-1', 'address-1', body as never, { tenantId: 'tenant-1' } as never);

    expect(contactsService.updateAddress).toHaveBeenCalledWith(
      'contact-1',
      'address-1',
      body,
      'tenant-1',
    );
  });

  it('falha quando o contexto do usuario nao possui tenant', () => {
    const { controller } = createController();

    expect(() => controller.findOne('contact-1', {} as never)).toThrow(UnauthorizedException);
  });
});
