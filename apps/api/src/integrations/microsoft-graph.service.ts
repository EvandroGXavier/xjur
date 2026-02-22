import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MicrosoftGraphService {
  private readonly logger = new Logger(MicrosoftGraphService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtém o token de acesso para um Tenant específico usando as credenciais do Azure
   */
  async getAccessToken(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || !tenant.msClientId || !tenant.msClientSecret || !tenant.msTenantId) {
      this.logger.warn(`Credenciais Microsoft ausentes para o tenant ${tenantId}`);
      return null;
    }

    try {
      // Usa isomorphic-fetch style (nativo no Node 18+) para chamar o Azure AD
      const response = await fetch(`https://login.microsoftonline.com/${tenant.msTenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: tenant.msClientId,
          scope: 'https://graph.microsoft.com/.default',
          client_secret: tenant.msClientSecret,
          grant_type: 'client_credentials',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Falha ao obter token: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update the access token in database for caching (Optional but good)
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { msAccessToken: data.access_token }
      });

      return data.access_token;
    } catch (error) {
      this.logger.error(`Erro ao autenticar no Microsoft Graph: ${error.message}`);
      return null;
    }
  }

  /**
   * setupFolderStructure(companyId, processoId)
   * Cria a hierarquia de pastas (1.1, 4.1, 5.1, 7.1, 8.1) baseada no modelo jurídico padrão.
   */
  async setupFolderStructure(tenantId: string, processId: string): Promise<boolean> {
    const token = await this.getAccessToken(tenantId);
    if (!token) return false;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const process = await this.prisma.process.findUnique({ where: { id: processId } });

    if (!tenant?.msFolderId || !process) {
      this.logger.warn(`Pasta raiz não configurada ou processo inexistente`);
      return false;
    }

    try {
      // 1. Criar a pasta do Processo dentro da pasta raiz do Escritório
      const processFolderName = process.code || process.cnj || processId.substring(0, 8);
      const processFolderResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${tenant.msTenantId}/drive/items/${tenant.msFolderId}/children`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "name": processFolderName,
          "folder": { },
          "@microsoft.graph.conflictBehavior": "rename"
        })
      });

      if (!processFolderResponse.ok) {
        throw new Error('Falha ao criar pasta do processo');
      }

      const processFolderData = await processFolderResponse.json();
      const newProcessFolderId = processFolderData.id;
      const newProcessFolderUrl = processFolderData.webUrl;

      // 2. Atualizar o Processo com o ID da nova pasta
      await this.prisma.process.update({
        where: { id: processId },
        data: { 
          msDriveId: newProcessFolderId,
          msFolderUrl: newProcessFolderUrl
        }
      });

      // 3. Criar Subpastas (1.1, 4.1, 5.1, 7.1, 8.1)
      const subFolders = [
        "1.1 - Procuração e Documentos Pessoais",
        "4.1 - Provas e Evidências",
        "5.1 - Custas e Guias",
        "7.1 - Decisões e Sentenças",
        "8.1 - Petições em Elaboração"
      ];

      for (const folderName of subFolders) {
        await fetch(`https://graph.microsoft.com/v1.0/users/${tenant.msTenantId}/drive/items/${newProcessFolderId}/children`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "name": folderName,
            "folder": { },
            "@microsoft.graph.conflictBehavior": "fail"
          })
        });
      }

      this.logger.log(`Estrutura de pastas criada para o processo ${processId}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro em setupFolderStructure: ${error.message}`);
      return false;
    }
  }

  /**
   * uploadToOneDrive(processId, documentId, htmlContent)
   * Converter HTML para DOCX (simulado/ou via pack) e enviar para a pasta 8.1 do processo.
   */
  async uploadToOneDrive(tenantId: string, processId: string, documentId: string, htmlContent: string): Promise<boolean> {
    const token = await this.getAccessToken(tenantId);
    if (!token) return false;

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process?.msDriveId) {
       this.logger.warn(`Processo ${processId} não possui pasta no OneDrive configurada.`);
       return false;
    }

    try {
      // TODO: Implementar conversão real de HTML para DOCX usando pacote 'html-to-docx'
      // Aqui usamos um envio de texto simulando o binário DOCX para ilustrar a integração Graph API
      // const fileBuffer = await htmlToDocx(htmlContent); // Exemplo se o pacote importado for usado
      
      // Placeholder para o Buffer gerado
      const fileBuffer = Buffer.from(htmlContent); 
      const fileName = `Documento_${documentId.substring(0, 8)}.docx`;

      // Primeiro, temos que encontrar o ID da subpasta '8.1 - Petições em Elaboração'
      const searchResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${tenantId}/drive/items/${process.msDriveId}/children`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const children = await searchResponse.json();
      const targetFolder = children.value?.find((f: any) => f.name.includes("8.1"));
      
      const uploadFolderId = targetFolder ? targetFolder.id : process.msDriveId; // Fallback para raiz do processo

      // Fazer o upload do ficheiro para a pasta selecionada
      const uploadResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${tenantId}/drive/items/${uploadFolderId}:/${fileName}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        body: fileBuffer
      });

      if (!uploadResponse.ok) {
        throw new Error('Falha no upload do documento');
      }

      const uploadData = await uploadResponse.json();

      // Salvar os IDs no banco
      await this.prisma.documentHistory.update({
        where: { id: documentId },
        data: {
          msFileId: uploadData.id,
          msFileUrl: uploadData.webUrl
        }
      });

      this.logger.log(`Upload efetuado para o documento ${documentId} no OneDrive.`);
      return true;
    } catch (error) {
      this.logger.error(`Erro em uploadToOneDrive: ${error.message}`);
      return false;
    }
  }

  /**
   * renameFolder(processoId, newName)
   * Renomear a pasta no OneDrive para evitar lixo se o nome do processo mudar.
   */
  async renameFolder(tenantId: string, processId: string, newName: string): Promise<boolean> {
    const token = await this.getAccessToken(tenantId);
    if (!token) return false;

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process?.msDriveId) return false;

    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${tenantId}/drive/items/${process.msDriveId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao renomear a pasta');
      }

      this.logger.log(`Pasta do processo ${processId} renomeada no OneDrive para ${newName}.`);
      return true;
    } catch (error) {
      this.logger.error(`Erro em renameFolder: ${error.message}`);
      return false;
    }
  }
}
