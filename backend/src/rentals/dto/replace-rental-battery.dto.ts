import { IsUUID } from 'class-validator'

export class ReplaceRentalBatteryDto {
  @IsUUID()
  removeBatteryId!: string

  @IsUUID()
  addBatteryId!: string
}
