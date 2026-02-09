
export class CreateMessageDto {
  content: string;
  contentType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';
  mediaUrl?: string;
}
