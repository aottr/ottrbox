import { IsBoolean, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateReverseShareDTO {

  @Length(3, 30)
  @IsOptional()
  name: string;

  @IsBoolean()
  sendEmailNotification: boolean;

  @IsString()
  maxShareSize: string;

  @IsString()
  shareExpiration: string;

  @Min(1)
  @Max(1000)
  maxUseCount: number;

  @IsBoolean()
  simplified: boolean;

  @IsBoolean()
  publicAccess: boolean;
}
