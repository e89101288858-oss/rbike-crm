import { IsIn, IsString, IsUUID } from 'class-validator'

export const ALLOWED_DOCUMENT_TYPES = ['PASSPORT', 'CONTRACT', 'ACT'] as const

export type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number]

export class CreateDocumentDto {
  @IsString()
  @IsUUID()
  clientId!: string

  @IsString()
  @IsIn(ALLOWED_DOCUMENT_TYPES)
  type!: AllowedDocumentType
}

