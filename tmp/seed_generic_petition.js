
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Generic Petition Template...');

  // Get first tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found. Please run main seed first.');
    return;
  }

  const tenantId = tenant.id;

  // 1. Find or Create Category
  let category = await prisma.documentCategory.findFirst({
    where: { tenantId, name: 'Petições e Manifestações' }
  });

  if (!category) {
    category = await prisma.documentCategory.create({
      data: {
        name: 'Petições e Manifestações',
        tenantId
      }
    });
    console.log('Created category: Petições e Manifestações');
  }

  // 2. Define Template Content (HTML)
  const templateTitle = 'PETIÇÃO GENÉRICA (MODELO DRX)';
  const content = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 800px; margin: 0 auto; padding: 20px;">
    
    <div style="margin-bottom: 40px; text-transform: uppercase; font-weight: bold;">
        {{VARA_PROCESSO}}
    </div>

    <div style="margin-bottom: 50px;">
        <strong>Processo Nº:</strong> {{NUMERO_PROCESSO}}
    </div>

    <p style="text-align: justify; margin-bottom: 30px;">
        <strong>{{NOME_CLIENTE}}</strong>, já qualificado nos autos mencionados, por meio de seu procurador que esta subscreve, vem, respeitosamente, perante Vossa Excelência, manifestar-se;
    </p>

    <div style="margin: 40px 0; min-height: 100px; padding: 15px; border: 1px dashed #ccc; background-color: #f9f9f9;">
        <p style="color: #666; font-style: italic;">[ DIGITE AQUI SUA MANIFESTAÇÃO ]</p>
    </div>

    <p style="margin-bottom: 40px;">
        Nestes termos,<br>
        pede e espera deferimento.
    </p>

    <p style="text-align: right; margin-bottom: 60px;">
        Belo Horizonte/MG, {{DATA_ATUAL}}.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
        <tr>
            <td style="width: 50%; text-align: center; vertical-align: bottom;">
                <div style="border-top: 1px solid #000; margin: 0 10px; padding-top: 5px;">
                    <strong>EVANDRO GERALDO XAVIER</strong><br>
                    OAB/MG 158.592
                </div>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: bottom;">
                <div style="border-top: 1px solid #000; margin: 0 10px; padding-top: 5px;">
                    <strong>LEANDRO RIBEIRO XAVIER</strong><br>
                    OAB/MG 226.816
                </div>
            </td>
        </tr>
        <tr>
            <td colspan="2" style="text-align: center; padding-top: 5px; font-size: 10px; font-weight: bold;">
                ADVOGADOS
            </td>
        </tr>
    </table>

    <footer style="margin-top: 100px; padding-top: 10px; border-top: 1px solid #eee; font-size: 10px; color: #555; text-align: center;">
        <strong>XAVIER XAVIER ADVOGADOS</strong><br>
        Rua Da Bahia, 603, Centro, Belo Horizonte/MG, CEP: 30.160-010<br>
        Contatos: (31) 9 9981-1174 | (31) 2534-7575 | E-mail: evandro@conectionmg.com.br
    </footer>
</div>
`;

  // 3. Create or Update Template
  const existingTemplate = await prisma.documentTemplate.findFirst({
    where: { tenantId, title: templateTitle }
  });

  if (existingTemplate) {
    await prisma.documentTemplate.update({
      where: { id: existingTemplate.id },
      data: { content, categoryId: category.id }
    });
    console.log('Updated existing template:', templateTitle);
  } else {
    const newTemplate = await prisma.documentTemplate.create({
      data: {
        title: templateTitle,
        content: content,
        categoryId: category.id,
        tenantId
      }
    });
    console.log('Created new template:', templateTitle, 'ID:', newTemplate.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
