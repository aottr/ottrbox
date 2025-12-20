import { OmitType } from "@nestjs/swagger";
import { Expose, plainToClass, Type } from "class-transformer";
import { MyShareDTO } from "src/share/dto/myShare.dto";
import { ReverseShareDTO } from "./reverseShare.dto";
import { MyShareSecurityDTO } from "src/share/dto/myShareSecurity.dto";

export class ReverseShareTokenWithShares extends OmitType(ReverseShareDTO, [
  "shareExpiration",
] as const) {
  @Expose()
  shareExpiration: Date;

  @Expose()
  @Type(() => OmitType(MyShareDTO, ["recipients", "hasPassword"] as const))
  shares: Omit<
    MyShareDTO,
    "recipients" | "files" | "from" | "fromList" | "hasPassword" | "size"
  >[];

  @Expose()
  remainingUses: number;

  @Expose()
  @Type(() => MyShareSecurityDTO)
  security: MyShareSecurityDTO;

  fromList(partial: Partial<ReverseShareTokenWithShares>[]) {
    return partial.map((part) =>
      plainToClass(ReverseShareTokenWithShares, part, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
