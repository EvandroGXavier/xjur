import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) {}

    @Get()
    findAll(@Request() req: any) {
        return this.workflowsService.findAll(req.user.tenantId);
    }

    @Get(':id')
    findOne(@Request() req: any, @Param('id') id: string) {
        return this.workflowsService.findOne(req.user.tenantId, id);
    }

    @Post()
    create(@Request() req: any, @Body() createData: any) {
        return this.workflowsService.create(req.user.tenantId, createData);
    }

    @Patch(':id')
    update(@Request() req: any, @Param('id') id: string, @Body() updateData: any) {
        return this.workflowsService.update(req.user.tenantId, id, updateData);
    }

    @Delete(':id')
    remove(@Request() req: any, @Param('id') id: string) {
        return this.workflowsService.remove(req.user.tenantId, id);
    }
}
