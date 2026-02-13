
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';

@Injectable()
export class ProcessTimelinesService {
    constructor(private prisma: PrismaService) {}

    async create(processId: string, data: any, files?: any[], user?: string) {
        let metadata: any = data.metadata || {};
        
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch {}
        }
        
        // Add user to metadata if provided
        if (user) {
            metadata.user = user;
        }
        
        const attachments = [];

        if (files && files.length > 0) {
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(process.cwd(), 'uploads', 'timelines');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of files) {
                const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
                const filePath = path.join(uploadDir, fileName);
                fs.writeFileSync(filePath, file.buffer);

                attachments.push({
                    originalName: file.originalname,
                    fileName: fileName,
                    path: `/uploads/timelines/${fileName}`,
                    mimeType: file.mimetype,
                    size: file.size
                });
            }
        }
        
        if (attachments.length > 0) {
            metadata.attachments = attachments;
            data.type = 'FILE'; 
        }

        // Enforce manual origin for user-created items
        const newItem = await this.prisma.processTimeline.create({
            data: {
                processId,
                title: data.title,
                description: data.description,
                date: new Date(data.date),
                type: data.type || (attachments.length > 0 ? 'FILE' : 'MOVEMENT'),
                origin: data.origin || 'INTERNO',
                internalDate: data.internalDate ? new Date(data.internalDate) : null,
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
                // Defaults
                source: 'MANUAL',
            },
        });
        return newItem;
    }

    async update(id: string, data: any, files?: any[]) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        let metadata: any = existing.metadata || {};
        if (typeof metadata === 'object' && metadata !== null) {
            // keep existing
        } else {
            metadata = {};
        }

        if (data.metadata) {
             // If we want to support updating other metadata fields passed as JSON string
             try {
                 const newMeta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
                 metadata = { ...metadata, ...newMeta };
             } catch {}
        }

        if (files && files.length > 0) {
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(process.cwd(), 'uploads', 'timelines');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const newAttachments = [];
            for (const file of files) {
                const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
                const filePath = path.join(uploadDir, fileName);
                fs.writeFileSync(filePath, file.buffer);

                newAttachments.push({
                    originalName: file.originalname,
                    fileName: fileName,
                    path: `/uploads/timelines/${fileName}`,
                    mimeType: file.mimetype,
                    size: file.size
                });
            }

            // Append to existing attachments
            const existingAttachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
            metadata.attachments = [...existingAttachments, ...newAttachments];
        }

        return this.prisma.processTimeline.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                date: data.date ? new Date(data.date) : undefined,
                internalDate: data.internalDate ? new Date(data.internalDate) : null, 
                fatalDate: data.fatalDate ? new Date(data.fatalDate) : null, 
                type: data.type,
                displayId: data.displayId,
                responsibleAdvogado: data.responsibleAdvogado,
                metadata: metadata,
            },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.processTimeline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Andamento não encontrado.');

        return this.prisma.processTimeline.delete({
            where: { id },
        });
    }

    getAttachmentPath(fileName: string) {
        const path = require('path');
        return path.join(process.cwd(), 'uploads', 'timelines', fileName);
    }
}
