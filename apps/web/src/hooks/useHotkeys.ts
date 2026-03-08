import { useEffect } from 'react';

interface HotkeyOptions {
    onNew?: () => void;
    onCancel?: () => void;
    onPrint?: () => void;
    enableNew?: boolean;
    enableCancel?: boolean;
    enablePrint?: boolean;
}

export function useHotkeys({
    onNew,
    onCancel,
    onPrint,
    enableNew = true,
    enableCancel = true,
    enablePrint = true,
}: HotkeyOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Se o usuário estiver digitando em um input ou textarea (e não for ESC/F4), não intercepta,
            // a não ser que seja um atalho que normalmente não afeta textos como F2 ou F4.
            const target = e.target as HTMLElement;
            const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

            // Escapamos a verificação do isInput para ESC, F2, F4 porque eles raramente conflitam com edição normal
            // (a menos que a grid ou editor os use especificamente).

            // Cancelar / Fechar (ESC)
            if (e.key === 'Escape' && enableCancel && onCancel) {
                e.preventDefault();
                onCancel();
            }

            // Novo Registro (F2 ou NumpadAdd '+')
            // Cuidado: '+' dentro de um input/textarea deve escrever '+', não tentar abrir o painel novo, 
            // a não ser que estejamos fora do foco de edição! F2 sempre abre.
            if (((e.key === 'F2') || (e.code === 'NumpadAdd' && !isInput)) && enableNew && onNew) {
                e.preventDefault();
                onNew();
            }

            // Imprimir (F4)
            if (e.key === 'F4' && enablePrint && onPrint) {
                e.preventDefault();
                onPrint();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNew, onCancel, onPrint, enableNew, enableCancel, enablePrint]);
}
