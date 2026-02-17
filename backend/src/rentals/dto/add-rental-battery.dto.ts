import { IsUUID } from 'class-validator'

export class AddRentalBatteryDto {
  @IsUUID()
  batteryId!: string
}
