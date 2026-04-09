import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import {
  CreateSystemTemplateDto,
  UpdateSystemTemplateDto,
} from "./dto/system-template.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private ensureSuperAdmin(user: CurrentUserData) {
    const baseEmails = ["evandro@conectionmg.com.br"];
    const envEmails = (process.env.SUPERADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const allowedEmails = new Set(
      [...baseEmails, ...envEmails].map((email) => email.toLowerCase()),
    );

    if (!allowedEmails.has((user as any)?.email?.toLowerCase?.() || "")) {
      throw new UnauthorizedException("Acesso restrito ao SuperAdmin");
    }
  }

  @Post()
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.documentsService.create(createDocumentDto, user.tenantId);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query("processId") processId?: string,
    @Query("q") q?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
  ) {
    return this.documentsService.findAll(user.tenantId, {
      processId,
      q,
      sortBy,
      sortDirection,
    });
  }

  @Get("settings")
  getSettings() {
    return this.documentsService.getSettings();
  }

  @Put("settings/:key")
  updateSetting(@Param("key") key: string, @Body("value") value: string) {
    return this.documentsService.updateSetting(key, value);
  }

  // --- TENANT HEADER/FOOTER (por empresa) ---

  @Get("tenant-settings")
  getTenantSettings(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.getTenantDocumentLayout(user.tenantId);
  }

  @Put("tenant-settings")
  updateTenantSettings(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { headerHtml?: string; footerHtml?: string },
  ) {
    return this.documentsService.updateTenantDocumentLayout(
      user.tenantId,
      body,
    );
  }

  // --- CATEGORIES ---

  @Get("categories")
  listCategories(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.listCategories(user.tenantId);
  }

  @Post("categories")
  createCategory(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.documentsService.createCategory(user.tenantId, dto);
  }

  // --- TEMPLATES / BIBLIOTECA ---

  @Get("variables")
  getVariables() {
    return this.documentsService.getVariables();
  }

  @Post("settings/seed")
  seedDefaults(@CurrentUser() user: CurrentUserData) {
    return this.documentsService.seedDefaults(user.tenantId);
  }

  @Post("templates")
  createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.documentsService.createTemplate(dto, user.tenantId);
  }

  @Get("templates")
  findAllTemplates(
    @CurrentUser() user: CurrentUserData,
    @Query("scope") scope?: string,
    @Query("q") q?: string,
    @Query("tag") tag?: string,
    @Query("includedTags") includedTags?: string,
    @Query("excludedTags") excludedTags?: string,
    @Query("categoryId") categoryId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDirection") sortDirection?: string,
  ) {
    return this.documentsService.findAllTemplates(user.tenantId, {
      scope,
      q,
      tag,
      includedTags,
      excludedTags,
      categoryId,
      sortBy,
      sortDirection,
    });
  }

  @Get("templates/:id")
  findTemplate(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.findTemplate(id, user.tenantId);
  }

  @Put("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.documentsService.updateTemplate(id, dto, user.tenantId);
  }

  @Delete("templates/:id")
  deleteTemplate(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.documentsService.deleteTemplate(id, user.tenantId);
  }

  @Post("templates/:id/render")
  renderTemplate(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
    @Body("contactId") contactId: string,
    @Body("processId") processId?: string,
  ) {
    return this.documentsService.renderTemplate(
      id,
      user.tenantId,
      contactId,
      processId,
      user.userId,
    );
  }

  @Post("templates/:id/m365")
  generateM365Document(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
    @Body("contactId") contactId: string,
    @Body("processId") processId?: string,
    @Body("timelineId") timelineId?: string,
    @Body("content") content?: string,
  ) {
    return this.documentsService.generateM365Document(
      id,
      user.tenantId,
      contactId,
      processId,
      user.userId,
      {
        timelineId,
        content,
      },
    );
  }

  @Post("templates/:id/customize")
  customizeTemplate(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() body: any,
  ) {
    return this.documentsService.customizeTemplate(id, user.tenantId, body);
  }

  @Post("system/sync")
  syncSystemLibrary(
    @CurrentUser() user: CurrentUserData,
    @Query("force") force?: string,
  ) {
    this.ensureSuperAdmin(user);
    const shouldForce = String(force || "").toLowerCase();
    return this.documentsService.syncSystemLibrary(user.tenantId, {
      force:
        shouldForce === "1" || shouldForce === "true" || shouldForce === "yes",
    });
  }

  // --- SYSTEM TEMPLATES (CRUD SuperAdmin) ---

  @Get("system/templates")
  listSystemTemplates(
    @CurrentUser() user: CurrentUserData,
    @Query("q") q?: string,
  ) {
    this.ensureSuperAdmin(user);
    return this.documentsService.listSystemTemplates(q);
  }

  @Post("system/templates")
  createSystemTemplate(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateSystemTemplateDto,
  ) {
    this.ensureSuperAdmin(user);
    return this.documentsService.createSystemTemplate(dto);
  }

  @Get("system/templates/:id")
  findSystemTemplate(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
  ) {
    this.ensureSuperAdmin(user);
    return this.documentsService.findSystemTemplate(id);
  }

  @Put("system/templates/:id")
  updateSystemTemplate(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() dto: UpdateSystemTemplateDto,
  ) {
    this.ensureSuperAdmin(user);
    return this.documentsService.updateSystemTemplate(id, dto);
  }

  @Delete("system/templates/:id")
  deleteSystemTemplate(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
  ) {
    this.ensureSuperAdmin(user);
    return this.documentsService.deleteSystemTemplate(id);
  }

  // --- IA (Aprimorar Documento/SeleÃ§Ã£o) ---

  @Post("ai/improve")
  improveDocument(@CurrentUser() user: CurrentUserData, @Body() body: any) {
    return this.documentsService.improveHtml(user.tenantId, body);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.findOne(id, user.tenantId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.documentsService.update(id, updateDocumentDto, user.tenantId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.documentsService.remove(id, user.tenantId);
  }
}
