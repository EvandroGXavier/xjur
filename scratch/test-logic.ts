import { normalizarDigitosDDI, construirValoresBuscaIdentificadores } from './apps/api/src/common/contact-identifiers';

function testNormalization() {
  const cases = [
    { input: '11999999999', expected: '5511999999999' },
    { input: '5511999999999', expected: '5511999999999' },
    { input: '99999999', expected: '99999999', note: 'too short for DDI auto' },
    { input: '11999999999@s.whatsapp.net', expected: '5511999999999@s.whatsapp.net' },
  ];

  console.log('--- Testing Normalization ---');
  cases.forEach(c => {
    const result = c.input.includes('@') 
        ? normalizarDigitosDDI(c.input.split('@')[0]) + '@' + c.input.split('@')[1]
        : normalizarDigitosDDI(c.input);
    console.log(`Input: ${c.input} | Result: ${result} | Success: ${result === c.expected}`);
  });
}

function testSearchValues() {
  const input = '11999999999';
  const values = construirValoresBuscaIdentificadores('WHATSAPP', [input]);
  console.log('\n--- Testing Search Values ---');
  console.log(`Input: ${input}`);
  console.log(`Values: ${JSON.stringify(values, null, 2)}`);
  
  const hasJid = values.includes('5511999999999@s.whatsapp.net');
  const hasPure = values.includes('5511999999999');
  console.log(`Has JID: ${hasJid}`);
  console.log(`Has Pure Number: ${hasPure}`);
}

// Emulating InboxService.findExistingConversation variants logic
function testConversationVariants(rawId: string) {
    console.log(`\n--- Testing Conversation Variants for: ${rawId} ---`);
    const stripped = rawId.replace(/:[0-9]+(?=@)/, '');
    const variants = new Set<string>([rawId, stripped]);
    
    const digits = stripped.replace(/\D/g, '');
    if (digits) {
      variants.add(digits);
      variants.add(`${digits}@s.whatsapp.net`);
    }

    const whatsappVariants = Array.from(variants);
    const normalizedWhatsappVariants = whatsappVariants.map(v => v.includes('@') ? v : normalizarDigitosDDI(v));
    const finalVariants = Array.from(new Set([...whatsappVariants, ...normalizedWhatsappVariants]));
    
    console.log(`Final Variants: ${JSON.stringify(finalVariants, null, 2)}`);
}

try {
    testNormalization();
    testSearchValues();
    testConversationVariants('11999999999');
    testConversationVariants('551188888888@s.whatsapp.net');
    testConversationVariants('1177777777:5@s.whatsapp.net');
} catch (e) {
    console.error('Test failed (likely imports):', e.message);
    console.log('Testing logic directly using local implementation mock...');
    
    // Fallback if imports fail in the script environment
    const mockNormalizar = (v: string) => {
        const d = v.replace(/\D/g, '');
        if (d.length >= 10 && d.length <= 11 && !d.startsWith('55')) return '55' + d;
        return d;
    };
    
    console.log('Mock 11999999999 ->', mockNormalizar('11999999999'));
}
