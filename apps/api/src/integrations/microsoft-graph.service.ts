import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as htmlToDocx from 'html-to-docx';

type TenantMicrosoftConfig = {
  id: string;
  name: string;
  msTenantId: string | null;
  msClientId: string | null;
  msClientSecret: string | null;
  msDriveId: string | null;
  msFolderId: string | null;
  msStorageActive: boolean;
};

type GraphCheck = {
  key: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  details: string;
};

type StorageContext = {
  driveId: string;
  rootFolderId: string;
  rootItem: any;
  source: 'configured_drive' | 'legacy_drive_in_folder_field' | 'discovered_user_drive' | 'discovered_root_site';
  ownerLabel?: string;
};

@Injectable()
export class MicrosoftGraphService {
  private readonly logger = new Logger(MicrosoftGraphService.name);
  private readonly graphBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(private prisma: PrismaService) {}

  async getAccessToken(tenantId: string, overrides: Record<string, any> = {}): Promise<string> {
    const tenant = await this.getTenantConfig(tenantId, overrides);

    if (!tenant.msClientId || !tenant.msClientSecret || !tenant.msTenantId) {
      throw new Error('Tenant ID, Client ID e Client Secret sao obrigatorios para autenticar no Microsoft Graph.');
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenant.msTenantId}/oauth2/v2.0/token`,
      {
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
      },
    );

    const payload = await this.parseResponse(response);
    if (!response.ok || !payload?.access_token) {
      const reason =
        payload?.error_description ||
        payload?.error?.message ||
        response.statusText ||
        'Falha ao obter token.';
      throw new Error(`Falha ao autenticar no Azure AD: ${reason}`);
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { msAccessToken: payload.access_token },
    });

    return payload.access_token as string;
  }

  async validateIntegration(tenantId: string, overrides: Record<string, any> = {}) {
    const checks: GraphCheck[] = [];
    const recommendations: string[] = [];
    const config = await this.getTenantConfig(tenantId, overrides);
    const guidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!config.msStorageActive) {
      checks.push({
        key: 'storage-active',
        label: 'Armazenamento Microsoft 365',
        status: 'warning',
        details: 'A opcao de armazenamento esta desativada para esta empresa.',
      });
      recommendations.push('Ative o armazenamento OneDrive/SharePoint antes de testar.');
      return {
        success: false,
        checks,
        recommendations,
      };
    }

    if (!config.msTenantId || !guidPattern.test(config.msTenantId)) {
      checks.push({
        key: 'tenant-id',
        label: 'Tenant ID',
        status: 'error',
        details: 'O Tenant ID precisa ser um GUID valido do Microsoft Entra ID.',
      });
      recommendations.push('Copie o Directory (tenant) ID diretamente do Azure e salve novamente.');
    }

    if (!config.msClientId || !guidPattern.test(config.msClientId)) {
      checks.push({
        key: 'client-id',
        label: 'Client ID',
        status: 'error',
        details: 'O Client ID precisa ser um GUID valido da aplicacao registrada no Azure.',
      });
      recommendations.push('Copie o Application (client) ID completo. O valor atual parece incompleto.');
    }

    if (!config.msFolderId) {
      checks.push({
        key: 'folder-id',
        label: 'Pasta raiz',
        status: 'error',
        details: 'Informe o ID da pasta raiz para a criacao de subpastas.',
      });
      recommendations.push('Defina a pasta raiz do OneDrive ou SharePoint antes de testar.');
    }

    if (checks.some((check) => check.status === 'error')) {
      if (!config.msDriveId && config.msFolderId) {
        recommendations.push('Preencha tambem o Drive ID/Biblioteca para reduzir erros de descoberta da pasta.');
      }

      return {
        success: false,
        checks,
        recommendations,
      };
    }

    try {
      const token = await this.getAccessToken(tenantId, overrides);
      checks.push({
        key: 'azure-auth',
        label: 'Autenticacao Azure',
        status: 'success',
        details: 'Token do Microsoft Graph obtido com sucesso.',
      });

      const context = await this.resolveStorageContext(tenantId, token, overrides);
      checks.push({
        key: 'root-folder',
        label: 'Pasta raiz configurada',
        status: 'success',
        details: `Pasta localizada em ${context.source === 'configured_drive' ? 'Drive configurado' : 'descoberta automatica'}: ${context.rootItem.name || context.rootFolderId}.`,
      });

      const tempFolderName = `DRX-TESTE-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const createdFolder = await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(context.rootFolderId)}/children`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tempFolderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        },
      );

      checks.push({
        key: 'folder-create',
        label: 'Criacao de pasta',
        status: 'success',
        details: `Pasta temporaria criada com sucesso: ${createdFolder.name}.`,
      });

      await this.graphRequest(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(createdFolder.id)}`,
        {
          method: 'DELETE',
        },
      );

      checks.push({
        key: 'folder-delete',
        label: 'Limpeza do teste',
        status: 'success',
        details: 'A pasta temporaria foi removida com sucesso.',
      });

      if (!config.msDriveId && context.driveId) {
        recommendations.push(`Drive ID identificado automaticamente: ${context.driveId}. Salve este valor para evitar novas descobertas.`);
      }

      return {
        success: true,
        checks,
        recommendations,
        resolved: {
          driveId: context.driveId,
          folderId: context.rootFolderId,
          folderName: context.rootItem?.name || null,
          folderWebUrl: context.rootItem?.webUrl || null,
          source: context.source,
          ownerLabel: context.ownerLabel || null,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida no Microsoft Graph.';
      checks.push({
        key: 'integration-test',
        label: 'Teste de integracao',
        status: 'error',
        details: message,
      });

      if (!config.msDriveId && config.msFolderId && !this.isProbablyDriveId(config.msFolderId)) {
        recommendations.push('Preencha o Drive ID/Biblioteca para evitar ambiguidade na criacao de pastas.');
      }

      recommendations.push('Confirme as permissoes Application com consentimento de administrador: Files.ReadWrite.All, Sites.ReadWrite.All e User.Read.All.');

      return {
        success: false,
        checks,
        recommendations,
      };
    }
  }

  async setupFolderStructure(tenantId: string, processId: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken(tenantId);
      const context = await this.resolveStorageContext(tenantId, token);
      const process = await this.prisma.process.findUnique({ where: { id: processId } });

      if (!process) {
        this.logger.warn(`Processo ${processId} nao encontrado para criacao de pasta.`);
        return false;
      }

      if (process.msDriveId && process.msFolderUrl) {
        this.logger.log(`Processo ${processId} ja possui pasta Microsoft configurada.`);
        return true;
      }

      const processFolderName = process.code || process.cnj || processId.substring(0, 8);
      const rootChildren = await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(context.rootFolderId)}/children`,
      );

      const existingFolder = rootChildren?.value?.find(
        (item: any) => item?.folder && item.name === processFolderName,
      );

      const processFolder = existingFolder || await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(context.rootFolderId)}/children`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: processFolderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        },
      );

      await this.prisma.process.update({
        where: { id: processId },
        data: {
          msDriveId: processFolder.id,
          msFolderUrl: processFolder.webUrl,
          folder: processFolder.webUrl,
        },
      });

      const subFolders = [
        '1.1 - Procuracao e Documentos Pessoais',
        '4.1 - Provas e Evidencias',
        '5.1 - Custas e Guias',
        '7.1 - Decisoes e Sentencas',
        '8.1 - Peticoes em Elaboracao',
      ];

      const processChildren = await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(processFolder.id)}/children`,
      );
      const existingSubFolders = new Set(
        (processChildren?.value || [])
          .filter((item: any) => item?.folder)
          .map((item: any) => item.name),
      );

      for (const folderName of subFolders) {
        if (existingSubFolders.has(folderName)) {
          continue;
        }

        await this.graphRequest(
          token,
          `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(processFolder.id)}/children`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: folderName,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename',
            }),
          },
        );
      }

      this.logger.log(`Estrutura de pastas criada para o processo ${processId}.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro em setupFolderStructure: ${message}`);
      return false;
    }
  }

  async uploadToOneDrive(
    tenantId: string,
    processId: string,
    documentId: string,
    htmlContent: string,
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken(tenantId);
      const context = await this.resolveStorageContext(tenantId, token);
      const process = await this.prisma.process.findUnique({ where: { id: processId } });

      if (!process?.msDriveId) {
        this.logger.warn(`Processo ${processId} nao possui pasta Microsoft configurada.`);
        return false;
      }

      const fileBuffer = await htmlToDocx(htmlContent, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });

      const fileName = `Documento_${documentId.substring(0, 8)}.docx`;
      const children = await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(process.msDriveId)}/children`,
      );

      const targetFolder = children?.value?.find((item: any) => item.name?.includes('8.1'));
      const uploadFolderId = targetFolder?.id || process.msDriveId;

      const uploadResponse = await fetch(
        `${this.graphBaseUrl}/drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(uploadFolderId)}:/${encodeURIComponent(fileName)}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          body: fileBuffer as any,
        },
      );

      const uploadData = await this.parseResponse(uploadResponse);
      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error?.message || 'Falha no upload do documento para o OneDrive.');
      }

      await this.prisma.documentHistory.update({
        where: { id: documentId },
        data: {
          msFileId: uploadData.id,
          msFileUrl: uploadData.webUrl,
        },
      });

      this.logger.log(`Upload efetuado para o documento ${documentId} no OneDrive.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro em uploadToOneDrive: ${message}`);
      return false;
    }
  }

  async renameFolder(tenantId: string, processId: string, newName: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken(tenantId);
      const context = await this.resolveStorageContext(tenantId, token);
      const process = await this.prisma.process.findUnique({ where: { id: processId } });

      if (!process?.msDriveId) {
        return false;
      }

      await this.graphRequest(
        token,
        `drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(process.msDriveId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        },
      );

      this.logger.log(`Pasta do processo ${processId} renomeada para ${newName}.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Erro em renameFolder: ${message}`);
      return false;
    }
  }

  private async getTenantConfig(
    tenantId: string,
    overrides: Record<string, any> = {},
  ): Promise<TenantMicrosoftConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        msTenantId: true,
        msClientId: true,
        msClientSecret: true,
        msDriveId: true,
        msFolderId: true,
        msStorageActive: true,
      },
    });

    if (!tenant) {
      throw new Error('Empresa nao encontrada.');
    }

    return {
      ...tenant,
      msTenantId: this.pickOverride(overrides.msTenantId, tenant.msTenantId),
      msClientId: this.pickOverride(overrides.msClientId, tenant.msClientId),
      msClientSecret: this.pickOverride(overrides.msClientSecret, tenant.msClientSecret),
      msDriveId: this.pickOverride(overrides.msDriveId, tenant.msDriveId),
      msFolderId: this.pickOverride(overrides.msFolderId, tenant.msFolderId),
      msStorageActive:
        overrides.msStorageActive !== undefined ? Boolean(overrides.msStorageActive) : tenant.msStorageActive,
    };
  }

  private async resolveStorageContext(
    tenantId: string,
    token: string,
    overrides: Record<string, any> = {},
  ): Promise<StorageContext> {
    const config = await this.getTenantConfig(tenantId, overrides);
    const configuredDriveId = this.clean(config.msDriveId);
    const configuredFolderId = this.clean(config.msFolderId);

    if (configuredDriveId) {
      const rootItem = configuredFolderId
        ? await this.graphRequest<any>(
            token,
            `drives/${encodeURIComponent(configuredDriveId)}/items/${encodeURIComponent(configuredFolderId)}`,
          )
        : await this.graphRequest<any>(token, `drives/${encodeURIComponent(configuredDriveId)}/root`);

      return {
        driveId: configuredDriveId,
        rootFolderId: rootItem.id,
        rootItem,
        source: 'configured_drive',
      };
    }

    if (!configuredFolderId) {
      throw new Error('Informe ao menos o ID da pasta raiz ou o Drive ID/Biblioteca.');
    }

    if (this.isProbablyDriveId(configuredFolderId)) {
      const rootItem = await this.graphRequest<any>(
        token,
        `drives/${encodeURIComponent(configuredFolderId)}/root`,
      );

      return {
        driveId: configuredFolderId,
        rootFolderId: rootItem.id,
        rootItem,
        source: 'legacy_drive_in_folder_field',
      };
    }

    const rootSiteItem = await this.graphRequest<any>(
      token,
      `sites/root/drive/items/${encodeURIComponent(configuredFolderId)}`,
      {},
      true,
    );
    if (rootSiteItem?.parentReference?.driveId) {
      return {
        driveId: rootSiteItem.parentReference.driveId,
        rootFolderId: rootSiteItem.id,
        rootItem: rootSiteItem,
        source: 'discovered_root_site',
      };
    }

    const discoveredUserDrive = await this.discoverDriveFromUsers(token, configuredFolderId);
    if (discoveredUserDrive) {
      return {
        driveId: discoveredUserDrive.item.parentReference.driveId,
        rootFolderId: discoveredUserDrive.item.id,
        rootItem: discoveredUserDrive.item,
        source: 'discovered_user_drive',
        ownerLabel: discoveredUserDrive.ownerLabel,
      };
    }

    throw new Error(
      'Nao foi possivel descobrir o Drive ID automaticamente a partir do Folder ID informado. Preencha o Drive ID/Biblioteca e teste novamente.',
    );
  }

  private async discoverDriveFromUsers(token: string, folderId: string) {
    let nextPath = 'users?$select=id,displayName,userPrincipalName&$top=50';
    let pageCount = 0;

    while (nextPath && pageCount < 5) {
      const page = await this.graphRequest<any>(token, nextPath);
      for (const user of page?.value || []) {
        const item = await this.graphRequest<any>(
          token,
          `users/${encodeURIComponent(user.id)}/drive/items/${encodeURIComponent(folderId)}`,
          {},
          true,
        );

        if (item?.parentReference?.driveId) {
          return {
            item,
            ownerLabel: user.displayName || user.userPrincipalName || user.id,
          };
        }
      }

      nextPath = this.toRelativeGraphPath(page?.['@odata.nextLink']);
      pageCount += 1;
    }

    return null;
  }

  private toRelativeGraphPath(nextLink?: string) {
    if (!nextLink) {
      return null;
    }

    return nextLink.replace(`${this.graphBaseUrl}/`, '');
  }

  private async graphRequest<T = any>(
    token: string,
    path: string,
    init: RequestInit = {},
    allowNotFound = false,
  ): Promise<T | null> {
    const response = await fetch(`${this.graphBaseUrl}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    if (allowNotFound && response.status === 404) {
      await this.parseResponse(response);
      return null;
    }

    const payload = await this.parseResponse(response);
    if (!response.ok) {
      const detail =
        payload?.error?.message ||
        payload?.error_description ||
        response.statusText ||
        'Erro no Microsoft Graph.';
      throw new Error(`${detail} [${response.status}]`);
    }

    return payload as T;
  }

  private async parseResponse(response: Response) {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private clean(value?: string | null) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private pickOverride(overrideValue: any, currentValue: string | null) {
    if (overrideValue === undefined) {
      return currentValue;
    }

    if (overrideValue === null) {
      return null;
    }

    const cleaned = String(overrideValue).trim();
    return cleaned || null;
  }

  private isProbablyDriveId(value?: string | null) {
    if (!value) {
      return false;
    }

    return value.startsWith('b!') || value.startsWith('s!');
  }
}
