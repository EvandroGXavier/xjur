import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface ProcessData {
    cnj: string;
    npu: string;
    court: string;
    courtSystem: string;
    vars: string;
    district: string;
    status: string;
    area: string;
    subject: string;
    class: string;
    distributionDate: Date;
    judge: string;
    value: number;
    parties: Array<{ name: string; type: string; document?: string }>;
    movements: Array<{ date: Date; description: string; type: string }>;
}

@Injectable()
export class ProcessCrawlerService {
    
    /**
     * Busca universal (CNJ, CPF, Nome)
     */
    async search(term: string): Promise<ProcessData | ProcessData[]> {
        // Remove pontuação para análise
        const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
        
        // Simulação de delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Se parece CNJ (apenas números e longo)
        if (/^\d{15,20}$/.test(cleanTerm)) {
             return this.crawlByCnj(cleanTerm);
        }

        // Mock Inteligente para Testes
        const isDoc = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(cleanTerm) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(cleanTerm);
        
        const autorName = isDoc ? 'Autor Simulado (Busca por CPF)' : term.toUpperCase();
        const autorDoc = isDoc ? term : '000.000.000-00';

        return {
            cnj: '5009999-88.2025.8.13.0024',
            npu: '5009999-88.2025.8.13.0024',
            court: 'TJMG',
            courtSystem: 'PJe',
            vars: '1ª Vara Empresarial',
            district: 'Belo Horizonte',
            status: 'DISTRIBUÍDO',
            area: 'Cível',
            subject: 'Execução de Título Extrajudicial',
            class: 'Execução',
            distributionDate: new Date('2025-02-01'),
            judge: 'Dr. Substituto',
            value: 12500.50,
            parties: [
                { name: autorName, type: 'AUTOR', document: autorDoc },
                { name: 'Réu Genérico SA', type: 'RÉU', document: '99.999.999/0001-99' }
            ],
            movements: [
               { date: new Date(), description: 'Distribuição Automática', type: 'DISTRIBUTION' }
            ]
        };
    }
    
    /**
     * Simula a busca de dados processuais em Tribunais
     */ 
    async crawlByCnj(cnj: string): Promise<ProcessData> {
        // Validação básica de CNJ (simulação)
        const cleanCNJ = cnj.replace(/\D/g, '');
        if (cleanCNJ.length < 10) {
            throw new HttpException('CNJ inválido', HttpStatus.BAD_REQUEST);
        }

        // Simulação de delay de Crawler
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // Mock Inteligente baseado no CNJ para parecer real
        const isTJMG = cnj.includes('.8.13.');
        const isTRF1 = cnj.includes('.4.01.');
        const isLabor = cnj.includes('.5.03.');

        let court = 'OUTRO';
        let system = 'Desconhecido';
        
        if(isTJMG) { court = 'TJMG'; system = 'PJe'; }
        if(isTRF1) { court = 'TRF1'; system = 'PJe Federal'; }
        if(isLabor) { court = 'TRT3'; system = 'PJe-JT'; }

        // Retorno Simulado (Dr.X Mock)
        return {
            cnj: cnj,
            npu: `${cleanCNJ.substring(0, 7)}-${cleanCNJ.substring(7, 9)}.${cleanCNJ.substring(9, 13)}.${cleanCNJ.substring(13, 14)}.${cleanCNJ.substring(14, 16)}.${cleanCNJ.substring(16)}`,
            court: court,
            courtSystem: system,
            vars: '2ª Vara Cível',
            district: 'Belo Horizonte',
            status: 'ATIVO',
            area: 'Cível',
            subject: 'Indenização por Danos Morais',
            class: 'Procedimento Comum Cível',
            distributionDate: new Date('2025-01-15'),
            judge: 'Dr. João da Silva (Simulado)',
            value: 50000.00,
            parties: [
                { name: 'Empresa X Ltda', type: 'AUTOR', document: '12.345.678/0001-90' },
                { name: 'Consumidor Y', type: 'RÉU', document: '123.456.789-00' }
            ],
            movements: [
                { date: new Date(), description: 'Conclusos para Decisão', type: 'UPDATE' },
                { date: new Date(Date.now() - 86400000 * 5), description: 'Juntada de Petição', type: 'PETITION' }
            ]
        };
    }
}
