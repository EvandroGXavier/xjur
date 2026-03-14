
import { ProcessIntegrationsService } from '../src/processes/process-integrations.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma.service';

async function testExtraction() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [ProcessIntegrationsService, PrismaService],
  }).compile();

  const service = module.get<ProcessIntegrationsService>(ProcessIntegrationsService);

  // Mock payload based on observed DataJud structures with nested participants
  const mockHit = {
    _source: {
      numeroProcesso: '50012345620238130024',
      tribunal: 'TJMG',
      classe: { nome: 'Procedimento Comum' },
      poloAtivo: [
        {
          nome: 'Polo Ativo Wrapper',
          participantes: [
            { nome: 'Joao da Silva', numeroDocumento: '12345678901', tipo: 'AUTOR' },
            { nome: 'Maria Souza', tipo: 'AUTORA' }
          ]
        }
      ],
      poloPassivo: [
        {
          participantes: [
            { nome: 'Banco do Brasil', numeroDocumento: '00000000000191', tipo: 'REU' }
          ]
        }
      ],
      advogados: [
        { nome: 'Dr. Advogado', numeroDocumento: '11122233344', tipo: 'ADVOGADO' }
      ]
    }
  };

  console.log('--- Testing Extraction ---');
  // @ts-ignore - accessing private or protected for testing
  const parties = service.extractPartiesFromSource(mockHit._source);
  
  console.log(`Extracted ${parties.length} parties:`);
  parties.forEach(p => {
    console.log(` - ${p.name} | ${p.type} | Doc: ${p.document || 'N/A'}`);
  });

  const expectedNames = ['Joao da Silva', 'Maria Souza', 'Banco do Brasil', 'Dr. Advogado'];
  const allFound = expectedNames.every(name => parties.some(p => p.name === name));

  if (allFound) {
    console.log('\nSUCCESS: All nested parties extracted correctly!');
  } else {
    console.log('\nFAILURE: Some parties were missed.');
  }
}

testExtraction().catch(console.error);
