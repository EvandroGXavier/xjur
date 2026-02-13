import { Injectable, BadRequestException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import { PrismaService } from '@drx/database';
import { ContactsService } from './contacts.service';
import { ImportContactsDto, ContactMappingDto } from './dto/import-contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsImportService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService
  ) {}

  async parseFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    
    // Read buffer
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (Objects)
    // defval: '' ensures empty cells have empty string instead of undefined, helps with key consistency
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' }); 
    
    if (data.length === 0) return { headers: [], preview: [], data: [], totalRows: 0 };

    // Get headers from first row keys
    const headers = Object.keys(data[0] as object);
    
    // Generate preview
    const maxPreviewRows = 5;
    const preview = data.slice(0, maxPreviewRows);

    return { 
      headers, 
      preview,
      data, 
      totalRows: data.length
    };
  }

  async executeImport(tenantId: string, dtos: ImportContactsDto) {
    const { data, mapping, duplicateAction } = dtos;
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Skip header row if it exists in data (usually data passed here is full JSON array)
    // Actually, let's assume 'data' passed from frontend is the array of objects already?
    // The frontend should probably pass the raw rows it received or we re-parse.
    // Better: Frontend sends the mapped objects? No, frontend sends the raw objects and the mapping.
    
    for (const [index, row] of data.entries()) {
      try {
        const contactDto = this.mapRowToDto(row, mapping);
        
        // Basic Validation
        if (!contactDto.name) {
             throw new Error('Name is required');
        }

        // Check Duplicates
        if (contactDto.document) {
            const existing = await this.prisma.contact.findFirst({
                where: { 
                    tenantId, 
                    document: contactDto.document 
                }
            });

            if (existing) {
                if (duplicateAction === 'skip') {
                    results.failed++;
                    results.errors.push({ row: index + 1, error: 'Duplicate document skipped' });
                    continue;
                }
                
                if (duplicateAction === 'update') {
                    // mapRowToDto returns CreateContactDto, we can use it as UpdateContactDto for basic fields
                    // Note: This update implementation currently does NOT update addresses or additional contacts to avoid duplication/complexity
                    await this.contactsService.update(existing.id, contactDto);
                    results.success++;
                    continue;
                }
            }
        }

        await this.contactsService.create(contactDto, tenantId);
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push({ 
            row: index + 1, 
            error: error instanceof Error ? error.message : 'Unknown error',
            data: row
        });
      }
    }

    return results;
  }

  private mapRowToDto(row: any, mapping: ContactMappingDto): CreateContactDto {
    const getValue = (key?: string) => key ? row[key] : undefined;

    const document = getValue(mapping.document)?.toString().replace(/\D/g, '') || undefined;
    const isCNPJ = document && document.length > 11;
    const personType = isCNPJ ? 'PJ' : 'PF';

    const dto: any = {
        name: getValue(mapping.name),
        email: getValue(mapping.email),
        phone: getValue(mapping.phone),
        whatsapp: getValue(mapping.whatsapp),
        document: document,
        personType: personType,
        notes: getValue(mapping.notes),
        category: getValue(mapping.category),
        active: true,
    };

    // Address construction
    const street = getValue(mapping.address_street);
    if (street) {
        dto.addresses = [{
            street: street,
            number: getValue(mapping.address_number) || 'S/N',
            city: getValue(mapping.address_city) || '',
            state: getValue(mapping.address_state) || '',
            zipCode: getValue(mapping.address_zip) || ''
        }];
    }

    // PF/PJ Details (simplified)
    if (personType === 'PF') {
        dto.cpf = document;
        // In a real scenario, we would map specific columns to CPF, RG, etc.
        // For MVP, we auto-assign document to CPF
    } else {
        dto.cnpj = document;
        dto.companyName = getValue(mapping.companyName); // Razão Social (from dedicated col if mapped)
        dto.stateRegistration = getValue(mapping.stateRegistration); // IE
        
        // If companyName (Razão Social) is missing but we have a name (Nome Fantasia), use name as companyName fallback?
        // Or keep distinct. Let's keep distinct.
        // If 'name' is mapped to Razão Social in the file, then 'name' property will hold Razão Social.
        // Frontend mapping will clarify: "Nome de Exibição / Fantasia" -> name
        // "Razão Social" -> companyName
    }

    return dto as CreateContactDto;
  }
}
