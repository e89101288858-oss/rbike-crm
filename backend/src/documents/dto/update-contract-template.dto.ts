import { IsString, MinLength } from 'class-validator'

export class UpdateContractTemplateDto {
  @IsString()
  @MinLength(20)
  templateHtml!: string
}
