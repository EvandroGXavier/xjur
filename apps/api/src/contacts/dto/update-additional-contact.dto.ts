import { PartialType } from '@nestjs/mapped-types';
import { CreateAdditionalContactDto } from './create-additional-contact.dto';

export class UpdateAdditionalContactDto extends PartialType(CreateAdditionalContactDto) {}
